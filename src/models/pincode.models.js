import mongoose from "mongoose";

const pincodeSchema = new mongoose.Schema(
  {
    pincode: {
      type: String,
      required: true,
      unique: true,
      match: /^\d{6}$/,
    },
    isServiceable: {
      type: Boolean,
      default: true,
    },
    estimatedDays: {
      type: String,
      default: "1-2",
    },
    city: {
      type: String,
      default: "",
    },
    state: {
      type: String,
      default: "",
    },
    district: {
      type: String,
      default: "",
    },
    area: {
      type: String,
      default: "",
    },
    lastVerifiedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

pincodeSchema.index({ pincode: 1 });
pincodeSchema.index({ isServiceable: 1 });

export default mongoose.model("Pincode", pincodeSchema);