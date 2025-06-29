import express, {Express} from "express";
import dotenv from "dotenv";
import cors, {CorsOptions} from "cors";

import RouteLoader from "./RouteLoader.ts";

dotenv.config();

const app: Express = express();
const INTERNAL_PORT = process.env.INTERNAL_SERVER_PORT;
const EXPOSED_PORT = process.env.SERVER_PORT;

app.use(express.json());

const corsOptions: CorsOptions = {
  origin: "*",
  credentials: true
}

app.use(cors(corsOptions));

const routes = await RouteLoader();
app.use("/", routes);

app.listen(INTERNAL_PORT, () => {
  console.log(
    `[SERVER]: SERVER is running at http://localhost:${EXPOSED_PORT}`,
  );
});
