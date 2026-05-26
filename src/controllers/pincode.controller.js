import Pincode from "../models/pincode.models.js";
import redisClient from "../config/redis.js";

export const addPincode = async (req, res) => {
  try {
    const { pincode, isServiceable } = req.body;

    if (!pincode) {
      return res.status(400).json({ message: "Pincode is required" });
    }

    const existing = await Pincode.findOne({ pincode });
    if (existing) {
      return res.status(409).json({ message: "Pincode already exists" });
    }

    const newPin = await Pincode.create({
      pincode,
      isServiceable: isServiceable !== undefined ? isServiceable : true,
    });

    await redisClient.del(`pincode:${pincode}`);

    res.status(201).json(newPin);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const checkPincode = async (req, res) => {
  try {
    const { pincode } = req.params;

    const cached = await redisClient.get(`pincode:${pincode}`);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const pin = await Pincode.findOne({ pincode });

    if (!pin) {
      return res.status(404).json({ message: "Pincode not found" });
    }

    await redisClient.setEx(`pincode:${pincode}`, 3600, JSON.stringify(pin));

    res.json(pin);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deletePincode = async (req, res) => {
  try {
    const { pincode } = req.params;

    const deleted = await Pincode.findOneAndDelete({ pincode });

    if (!deleted) {
      return res.status(404).json({ message: "Pincode not found" });
    }

    await redisClient.del(`pincode:${pincode}`);

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAllPincodes = async (req, res) => {
  try {
    const data = await Pincode.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
