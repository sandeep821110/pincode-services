import express from "express";
import {
  addPincode,
  checkPincode,
  deletePincode,
  getAllPincodes,
  bulkAddPincodes,
  updatePincode,
} from "../controllers/pincode.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, addPincode);
router.post("/bulk", authMiddleware, bulkAddPincodes);
router.get("/", authMiddleware, getAllPincodes);
router.get("/:pincode", checkPincode);
router.put("/:pincode", authMiddleware, updatePincode);
router.delete("/:pincode", authMiddleware, deletePincode);

export default router;
