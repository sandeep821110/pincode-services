import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";

jest.unstable_mockModule("../src/models/pincode.models.js", () => ({
  default: {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    findOneAndDelete: jest.fn(),
  },
}));

jest.unstable_mockModule("../src/config/redis.js", () => ({
  default: {
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
  },
}));

const { default: app } = await import("../src/app.js");
const { default: Pincode } = await import("../src/models/pincode.models.js");

const validToken = jwt.sign(
  { sub: "microservice" },
  process.env.JWT_SECRET
);

const mockPincode = {
  _id: "507f1f77bcf86cd799439012",
  pincode: "110001",
  isServiceable: true,
};

describe("Pincode Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/pincodes", () => {
    it("should add a new pincode with valid token", async () => {
      Pincode.findOne.mockResolvedValue(null);
      Pincode.create.mockResolvedValue(mockPincode);

      const res = await request(app)
        .post("/api/pincodes")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ pincode: "110001" })
        .expect(201);

      expect(res.body.pincode).toBe("110001");
    });

    it("should return 409 for duplicate pincode", async () => {
      Pincode.findOne.mockResolvedValue(mockPincode);

      const res = await request(app)
        .post("/api/pincodes")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ pincode: "110001" })
        .expect(409);

      expect(res.body.message).toBe("Pincode already exists");
    });

    it("should return 401 without token", async () => {
      const res = await request(app)
        .post("/api/pincodes")
        .send({ pincode: "110001" })
        .expect(401);

      expect(res.body.message).toBe("Unauthorized");
    });
  });

  describe("GET /api/pincodes/:pincode", () => {
    it("should check a serviceable pincode (public)", async () => {
      Pincode.findOne.mockResolvedValue(mockPincode);

      const res = await request(app)
        .get("/api/pincodes/110001")
        .expect(200);

      expect(res.body.pincode).toBe("110001");
    });

    it("should return 404 for non-existent pincode", async () => {
      Pincode.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/pincodes/999999")
        .expect(404);

      expect(res.body.message).toBe("Pincode not found");
    });
  });

  describe("DELETE /api/pincodes/:pincode", () => {
    it("should delete a pincode with valid token", async () => {
      Pincode.findOneAndDelete.mockResolvedValue(mockPincode);

      const res = await request(app)
        .delete("/api/pincodes/110001")
        .set("Authorization", `Bearer ${validToken}`)
        .expect(200);

      expect(res.body.message).toBe("Deleted successfully");
    });

    it("should return 404 if pincode not found", async () => {
      Pincode.findOneAndDelete.mockResolvedValue(null);

      const res = await request(app)
        .delete("/api/pincodes/999999")
        .set("Authorization", `Bearer ${validToken}`)
        .expect(404);

      expect(res.body.message).toBe("Pincode not found");
    });

    it("should return 401 without token", async () => {
      const res = await request(app)
        .delete("/api/pincodes/110001")
        .expect(401);

      expect(res.body.message).toBe("Unauthorized");
    });
  });

  describe("GET /api/pincodes", () => {
    it("should get all pincodes with valid token", async () => {
      Pincode.find.mockResolvedValue([mockPincode]);

      const res = await request(app)
        .get("/api/pincodes")
        .set("Authorization", `Bearer ${validToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it("should return 401 without token", async () => {
      const res = await request(app)
        .get("/api/pincodes")
        .expect(401);

      expect(res.body.message).toBe("Unauthorized");
    });
  });

  describe("Cookie-based auth", () => {
    it("should accept token from cookie", async () => {
      Pincode.findOne.mockResolvedValue(null);
      Pincode.create.mockResolvedValue(mockPincode);

      const res = await request(app)
        .post("/api/pincodes")
        .set("Cookie", `accessToken=${validToken}`)
        .send({ pincode: "110001" })
        .expect(201);

      expect(res.body.pincode).toBe("110001");
    });
  });
});
