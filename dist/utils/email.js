"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtpEmail = void 0;
const resend_1 = require("resend");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const resend = new resend_1.Resend(process.env.RESEND_API_KEY); // must be set in env
const sendOtpEmail = async (email, otp) => {
  try {
    const { data, error } = await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME || "Tradovate"} <${process.env.RESEND_FROM_EMAIL}>`,
      to: [email],
      subject: "Your OTP Code",
      html: `
        <div style="font-family:Arial, sans-serif; line-height:1.5;">
          <h2>Your OTP Code</h2>
          <p>Use the OTP below to continue:</p>
          <p style="font-size:22px; font-weight:bold; letter-spacing:2px;">
            ${otp}
          </p>
          <p>This code expires in 10 minutes.</p>
        </div>
      `,
    });
    if (error) {
      console.error("Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Unexpected email error:", err);
    return false;
  }
};
exports.sendOtpEmail = sendOtpEmail;
