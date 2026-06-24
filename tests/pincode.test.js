import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";

jest.unstable_mockModule("../src/models/pincode.models.js", () => ({
  default: {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    findOneAndDelete: jest.fn(),
    findOneAndUpdate: jest.fn(),
    insertMany: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.unstable_mockModule("../src/config/redis.js", () => ({
  default: {
    get: jest.fn(() => null),
    setEx: jest.fn(() => Promise.resolve()),
    del: jest.fn(() => Promise.resolve()),
    connect: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
  },
  isRedisAvailable: jest.fn(() => true),
  checkRedisHealth: jest.fn(() => Promise.resolve({ status: "healthy" })),
  getRedisStatus: jest.fn(() => ({})),
}));

const { default: app } = await import("../src/app.js");
const { default: Pincode } = await import("../src/models/pincode.models.js");

const validToken = jwt.sign(
  { id: "user123", role: "admin" },
  process.env.JWT_SECRET || "Qw8vZ!2r@7pLx#1e$9sTg^4bHjKmNcRf"
);

const mockPincode = {
  _id: "507f1f77bcf86cd799439012",
  pincode: "110001",
  isServiceable: true,
  estimatedDays: "3-5",
  city: "New Delhi",
  state: "Delhi",
  district: "New Delhi",
  area: "Connaught Place",
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

      expect(res.body.success).toBe(true);
      expect(res.body.data.pincode).toBe("110001");
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

    it("should return 400 for invalid pincode format", async () => {
      const res = await request(app)
        .post("/api/pincodes")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ pincode: "123" })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it("should return 401 without token", async () => {
      const res = await request(app)
        .post("/api/pincodes")
        .send({ pincode: "110001" })
        .expect(401);

      expect(res.body.message).toBe("Unauthorized");
    });
  });

  describe("POST /api/pincodes/bulk", () => {
    it("should bulk add pincodes", async () => {
      Pincode.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
      Pincode.insertMany.mockResolvedValue([{}, {}]);

      const res = await request(app)
        .post("/api/pincodes/bulk")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ pincodes: ["110001", "110002"] })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.added).toBe(2);
    });

    it("should return 400 for empty array", async () => {
      const res = await request(app)
        .post("/api/pincodes/bulk")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ pincodes: [] })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/pincodes/:pincode", () => {
    it("should check a serviceable pincode from DB (public)", async () => {
      Pincode.findOne.mockResolvedValue(mockPincode);

      const res = await request(app)
        .get("/api/pincodes/110001")
        .expect(200);

      expect(res.body.pincode).toBe("110001");
      expect(res.body.isServiceable).toBe(true);
      expect(res.body.estimatedDays).toBe("3-5");
    });

    it("should return 400 for invalid pincode format", async () => {
      const res = await request(app)
        .get("/api/pincodes/abc")
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it("should return 404 for non-existent pincode (India Post fallback fails)", async () => {
      Pincode.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/pincodes/999999")
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Delivery not available for this location");
    });
  });

  describe("PUT /api/pincodes/:pincode", () => {
    it("should update a pincode with valid token", async () => {
      Pincode.findOneAndUpdate.mockResolvedValue({
        ...mockPincode,
        isServiceable: false,
        estimatedDays: "5-7",
      });

      const res = await request(app)
        .put("/api/pincodes/110001")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ isServiceable: false, estimatedDays: "5-7" })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it("should return 401 without token", async () => {
      const res = await request(app)
        .put("/api/pincodes/110001")
        .send({ isServiceable: false })
        .expect(401);

      expect(res.body.message).toBe("Unauthorized");
    });
  });

  describe("DELETE /api/pincodes/:pincode", () => {
    it("should delete a pincode with valid token", async () => {
      Pincode.findOneAndDelete.mockResolvedValue(mockPincode);

      const res = await request(app)
        .delete("/api/pincodes/110001")
        .set("Authorization", `Bearer ${validToken}`)
        .expect(200);

      expect(res.body.message).toBe("Pincode deleted successfully");
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
    it("should get all pincodes with valid token (paginated)", async () => {
      Pincode.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockPincode]),
      });
      Pincode.countDocuments.mockResolvedValue(1);

      const res = await request(app)
        .get("/api/pincodes")
        .set("Authorization", `Bearer ${validToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination.total).toBe(1);
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
        .set("Cookie", `authToken=${validToken}`)
        .send({ pincode: "110001" })
        .expect(201);

      expect(res.body.success).toBe(true);
    });
  });
});
