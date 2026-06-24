import mongoose from "mongoose";

const villageSchema = new mongoose.Schema(
  {
    pincode: {
      type: String,
      required: true,
      match: /^\d{6}$/,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    branchType: {
      type: String,
      default: "",
    },
    deliveryStatus: {
      type: String,
      default: "Delivery",
    },
    isDeliveryAllowed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

villageSchema.index({ pincode: 1 });
villageSchema.index({ pincode: 1, name: 1 }, { unique: true });

export default mongoose.model("Village", villageSchema);
