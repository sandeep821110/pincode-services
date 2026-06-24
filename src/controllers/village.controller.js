import Pincode from "../models/pincode.models.js";
import Village from "../models/village.model.js";
import redisClient from "../config/redis.js";
import { logger } from "../utils/logger.js";

const POSTAL_API_URL = process.env.POSTAL_API_URL || "https://api.postalpincode.in";
const CACHE_TTL = parseInt(process.env.PINCODE_CACHE_TTL || "3600");

const validatePincode = (pincode) => /^\d{6}$/.test(pincode);

const fetchVillagesFromPostalAPI = async (pincode) => {
  try {
    const response = await fetch(`${POSTAL_API_URL}/pincode/${pincode}`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    const result = Array.isArray(data) ? data[0] : data;

    if (result?.Status !== "Success" || !Array.isArray(result.PostOffice)) {
      return [];
    }

    return result.PostOffice.map((po) => ({
      name: po.Name || "",
      branchType: po.BranchType || "",
      deliveryStatus: po.DeliveryStatus || "Delivery",
    })).filter((v) => v.name);
  } catch (err) {
    logger.warn(`Postal API village lookup failed for ${pincode}: ${err.message}`);
    return [];
  }
};

export const getVillagesByPincode = async (req, res) => {
  try {
    const { pincode } = req.params;

    if (!validatePincode(pincode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pincode format. Must be a 6-digit number.",
      });
    }

    let villages = await Village.find({ pincode }).sort({ name: 1 });

    if (villages.length === 0) {
      const apiVillages = await fetchVillagesFromPostalAPI(pincode);
      villages = apiVillages.map((v, i) => ({
        _id: `preview-${i}`,
        pincode,
        name: v.name,
        branchType: v.branchType,
        deliveryStatus: v.deliveryStatus,
        isDeliveryAllowed: v.deliveryStatus === "Delivery",
      }));
    }

    res.json({
      success: true,
      data: villages,
      total: villages.length,
    });
  } catch (err) {
    logger.error(`Error fetching villages for pincode ${req.params.pincode}:`, err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch villages",
    });
  }
};

export const toggleVillageDelivery = async (req, res) => {
  try {
    const { pincode, villageId } = req.params;
    const { isDeliveryAllowed } = req.body;

    if (typeof isDeliveryAllowed !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isDeliveryAllowed must be a boolean",
      });
    }

    const village = await Village.findOneAndUpdate(
      { _id: villageId, pincode },
      { $set: { isDeliveryAllowed } },
      { new: true }
    );

    if (!village) {
      return res.status(404).json({
        success: false,
        message: "Village not found for this pincode",
      });
    }

    res.json({
      success: true,
      data: village,
    });
  } catch (err) {
    logger.error(`Error toggling village delivery:`, err.message);
    res.status(500).json({
      success: false,
      message: "Failed to update village delivery status",
    });
  }
};

export const bulkSaveVillages = async (req, res) => {
  try {
    const { pincode } = req.params;
    const { villages } = req.body;

    if (!Array.isArray(villages) || villages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide an array of villages with isDeliveryAllowed",
      });
    }

    const ops = villages.map((v) => ({
      updateOne: {
        filter: { _id: v.villageId, pincode },
        update: { $set: { isDeliveryAllowed: v.isDeliveryAllowed } },
      },
    }));

    await Village.bulkWrite(ops);

    const updated = await Village.find({ pincode }).sort({ name: 1 });

    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    logger.error(`Error bulk saving villages:`, err.message);
    res.status(500).json({
      success: false,
      message: "Failed to save village delivery settings",
    });
  }
};
