// src/types/express.d.ts
import multer from "multer";

declare global {
  namespace Express {
    interface Request {
      files?: {
        [fieldname: string]: multer.File[];
      };
    }
  }
}
