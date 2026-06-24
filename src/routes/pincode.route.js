import express from "express";
import {
  addPincode,
  checkPincode,
  deletePincode,
  getAllPincodes,
  bulkAddPincodes,
  updatePincode,
} from "../controllers/pincode.controller.js";
import {
  getVillagesByPincode,
  toggleVillageDelivery,
  bulkSaveVillages,
} from "../controllers/village.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, addPincode);
router.post("/bulk", authMiddleware, bulkAddPincodes);
router.get("/", authMiddleware, getAllPincodes);
router.get("/:pincode", checkPincode);
router.put("/:pincode", authMiddleware, updatePincode);
router.delete("/:pincode", authMiddleware, deletePincode);

router.get("/:pincode/villages", getVillagesByPincode);
router.patch("/:pincode/villages/:villageId", authMiddleware, toggleVillageDelivery);
router.post("/:pincode/villages/save", authMiddleware, bulkSaveVillages);

export default router;
