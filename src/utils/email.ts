import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY); // must be set in env
export const sendOtpEmail = async (email: string, otp: string) => {
  try {
    const { data, error } = await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
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
