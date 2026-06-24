import Pincode from "../models/pincode.models.js";
import Village from "../models/village.model.js";
import redisClient from "../config/redis.js";
import { logger } from "../utils/logger.js";

const POSTAL_API_URL = process.env.POSTAL_API_URL || "https://api.postalpincode.in";
const CACHE_TTL = parseInt(process.env.PINCODE_CACHE_TTL || "3600");
const DEFAULT_ESTIMATED_DAYS = process.env.DEFAULT_ESTIMATED_DAYS || "1-2";

const validatePincode = (pincode) => /^\d{6}$/.test(pincode);

const getCacheKey = (pincode) => `pincode:${pincode}`;

const fetchFromPostalAPI = async (pincode) => {
  try {
    const response = await fetch(`${POSTAL_API_URL}/pincode/${pincode}`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    const result = Array.isArray(data) ? data[0] : data;

    if (result?.Status === "Success" && result?.PostOffice?.length > 0) {
      const po = result.PostOffice[0];
      return {
        valid: true,
        city: po.District || po.Block || "",
        state: po.State || "",
        district: po.District || "",
        area: po.Name || "",
        postOffices: result.PostOffice,
      };
    }
    return { valid: false };
  } catch (err) {
    logger.warn(`Postal API lookup failed for ${pincode}: ${err.message}`);
    return { valid: false, error: err.message };
  }
};

const seedVillagesForPincode = async (pincode, postOffices) => {
  try {
    const existingCount = await Village.countDocuments({ pincode });
    if (existingCount > 0) return;

    const villageDocs = postOffices
      .filter((po) => po.Name)
      .map((po) => ({
        pincode,
        name: po.Name,
        branchType: po.BranchType || "",
        deliveryStatus: po.DeliveryStatus || "Delivery",
        isDeliveryAllowed: po.DeliveryStatus === "Delivery",
      }));

    if (villageDocs.length > 0) {
      await Village.insertMany(villageDocs, { ordered: false });
      logger.info(`Seeded ${villageDocs.length} villages for pincode ${pincode}`);
    }
  } catch (err) {
    logger.warn(`Failed to seed villages for ${pincode}: ${err.message}`);
  }
};

const formatPincode = (pin) => ({
  _id: pin._id,
  pincode: pin.pincode,
  isServiceable: pin.isServiceable,
  estimatedDays: pin.estimatedDays || DEFAULT_ESTIMATED_DAYS,
  city: pin.city || "",
  state: pin.state || "",
  district: pin.district || "",
  area: pin.area || "",
});

export const checkPincode = async (req, res) => {
  try {
    const { pincode } = req.params;

    if (!validatePincode(pincode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pincode format. Must be a 6-digit number.",
      });
    }

    const cached = await redisClient.get(getCacheKey(pincode));
    if (cached) {
      return res.json(formatPincode(JSON.parse(cached)));
    }

    let pin = await Pincode.findOne({ pincode });

    if (pin) {
      await redisClient.setEx(getCacheKey(pincode), CACHE_TTL, JSON.stringify(pin));
      return res.json(formatPincode(pin));
    }

    // Fallback: validate via India Post API and auto-seed
    const postalResult = await fetchFromPostalAPI(pincode);

    if (!postalResult.valid) {
      return res.status(404).json({
        success: false,
        message: "Delivery not available for this location",
        pincode,
        isServiceable: false,
      });
    }

    const newPin = await Pincode.create({
      pincode,
      isServiceable: true,
      estimatedDays: DEFAULT_ESTIMATED_DAYS,
      city: postalResult.city,
      state: postalResult.state,
      district: postalResult.district,
      area: postalResult.area,
      lastVerifiedAt: new Date(),
    });

    await redisClient.setEx(getCacheKey(pincode), CACHE_TTL, JSON.stringify(newPin));
    logger.info(`Pincode auto-seeded via India Post: ${pincode}`, { city: postalResult.city, state: postalResult.state });

    if (postalResult?.postOffices) {
      await seedVillagesForPincode(pincode, postalResult.postOffices);
    }

    // Use 200 (not 201) so product service treats this as serviceable (checks response.status === 200)
    res.status(200).json(formatPincode(newPin));
  } catch (err) {
    logger.error(`Error checking pincode ${req.params.pincode}:`, err.message);
    res.status(500).json({
      success: false,
      message: "Failed to check pincode. Please try again.",
    });
  }
};

export const addPincode = async (req, res) => {
  try {
    const { pincode, isServiceable, estimatedDays, city, state, district, area } = req.body;

    if (!pincode || !validatePincode(pincode)) {
      return res.status(400).json({
        success: false,
        message: "A valid 6-digit pincode is required",
      });
    }

    const existing = await Pincode.findOne({ pincode });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Pincode already exists",
        data: formatPincode(existing),
      });
    }

    // Auto-resolve city/state via India Post if not provided
    let resolvedCity = city || "";
    let resolvedState = state || "";
    let resolvedDistrict = district || "";
    let resolvedArea = area || "";

    const postalResult = await fetchFromPostalAPI(pincode);
    if (postalResult.valid) {
      resolvedCity = resolvedCity || postalResult.city;
      resolvedState = resolvedState || postalResult.state;
      resolvedDistrict = resolvedDistrict || postalResult.district;
      resolvedArea = resolvedArea || postalResult.area;
    }

    const newPin = await Pincode.create({
      pincode,
      isServiceable: isServiceable !== undefined ? isServiceable : true,
      estimatedDays: estimatedDays || DEFAULT_ESTIMATED_DAYS,
      city: resolvedCity,
      state: resolvedState,
      district: resolvedDistrict,
      area: resolvedArea,
      lastVerifiedAt: new Date(),
    });

    await redisClient.del(getCacheKey(pincode));

    const { villages: villageDeliveryData } = req.body;
    if (Array.isArray(villageDeliveryData) && villageDeliveryData.length > 0) {
      const villageDocs = villageDeliveryData.map((v) => ({
        pincode,
        name: v.name,
        branchType: v.branchType || "",
        deliveryStatus: v.deliveryStatus || "Delivery",
        isDeliveryAllowed: v.isDeliveryAllowed === true,
      }));
      await Village.insertMany(villageDocs, { ordered: false });
      logger.info(`Seeded ${villageDocs.length} villages with delivery settings for pincode ${pincode}`);
    } else if (postalResult?.postOffices) {
      await seedVillagesForPincode(pincode, postalResult.postOffices);
    }

    res.status(201).json({
      success: true,
      data: formatPincode(newPin),
    });
  } catch (err) {
    logger.error("Error adding pincode:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to add pincode",
    });
  }
};

export const bulkAddPincodes = async (req, res) => {
  try {
    const { pincodes } = req.body;

    if (!Array.isArray(pincodes) || pincodes.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide an array of pincodes",
      });
    }

    const validPincodes = pincodes.map(String).filter(validatePincode);
    if (validPincodes.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid 6-digit pincodes in the list",
      });
    }

    const existing = await Pincode.find({ pincode: { $in: validPincodes } }).select("pincode");
    const existingSet = new Set(existing.map((e) => e.pincode));

    const newDocs = validPincodes
      .filter((p) => !existingSet.has(p))
      .map((p) => ({
        pincode: p,
        isServiceable: true,
        estimatedDays: DEFAULT_ESTIMATED_DAYS,
        lastVerifiedAt: new Date(),
      }));

    if (newDocs.length === 0) {
      return res.json({
        success: true,
        message: "All pincodes already exist",
        added: 0,
        skipped: validPincodes.length,
      });
    }

    await Pincode.insertMany(newDocs, { ordered: false });

    await Promise.all(
      newDocs.map((d) => redisClient.del(getCacheKey(d.pincode)).catch(() => {}))
    );

    logger.info(`Bulk added ${newDocs.length} pincodes`);

    res.status(201).json({
      success: true,
      message: `Added ${newDocs.length} pincodes`,
      added: newDocs.length,
      skipped: validPincodes.length - newDocs.length,
      total: validPincodes.length,
    });
  } catch (err) {
    logger.error("Error bulk adding pincodes:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to bulk add pincodes",
    });
  }
};

export const deletePincode = async (req, res) => {
  try {
    const { pincode } = req.params;

    if (!validatePincode(pincode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pincode format",
      });
    }

    const deleted = await Pincode.findOneAndDelete({ pincode });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Pincode not found",
      });
    }

    await redisClient.del(getCacheKey(pincode));

    res.json({
      success: true,
      message: "Pincode deleted successfully",
    });
  } catch (err) {
    logger.error("Error deleting pincode:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete pincode",
    });
  }
};

export const getAllPincodes = async (req, res) => {
  try {
    const { page = 1, limit = 100, search, isServiceable, sortBy = "pincode", sortOrder = "asc" } = req.query;

    const query = {};
    if (search) {
      query.pincode = { $regex: `^${search.replace(/\D/g, "")}`, $options: "i" };
    }
    if (isServiceable !== undefined) {
      query.isServiceable = isServiceable === "true";
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [data, total] = await Promise.all([
      Pincode.find(query).sort(sort).skip(skip).limit(parseInt(limit)),
      Pincode.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: data.map(formatPincode),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    logger.error("Error fetching pincodes:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pincodes",
    });
  }
};

export const updatePincode = async (req, res) => {
  try {
    const { pincode } = req.params;
    const { isServiceable, estimatedDays, city, state, district, area } = req.body;

    if (!validatePincode(pincode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pincode format",
      });
    }

    const updateFields = {};
    if (isServiceable !== undefined) updateFields.isServiceable = isServiceable;
    if (estimatedDays) updateFields.estimatedDays = estimatedDays;
    if (city) updateFields.city = city;
    if (state) updateFields.state = state;
    if (district) updateFields.district = district;
    if (area) updateFields.area = area;
    updateFields.lastVerifiedAt = new Date();

    const updated = await Pincode.findOneAndUpdate(
      { pincode },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Pincode not found",
      });
    }

    await redisClient.setEx(getCacheKey(pincode), CACHE_TTL, JSON.stringify(updated));

    res.json({
      success: true,
      data: formatPincode(updated),
    });
  } catch (err) {
    logger.error("Error updating pincode:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to update pincode",
    });
  }
};
