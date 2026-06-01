import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import app from "./app";

const PORT = Number(process.env.PORT || process.env.API_PORT) || 4000;

if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`API: http://localhost:${PORT} (усі інтерфейси)`);
  });
}
