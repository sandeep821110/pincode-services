import express from "express";
import {
  addPincode,
  checkPincode,
  deletePincode,
  getAllPincodes,
} from "../controllers/pincode.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, addPincode);
router.get("/", authMiddleware, getAllPincodes);
router.get("/:pincode", checkPincode);
router.delete("/:pincode", authMiddleware, deletePincode);

export default router;
