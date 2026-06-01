import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import app from "./app";

const PORT = Number(process.env.API_PORT) || 4000;

app.listen(PORT, () => {
  console.log(`API: http://localhost:${PORT}`);
});
