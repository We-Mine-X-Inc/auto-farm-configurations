import { DB_HOST, DB_DATABASE, DB_PASSWORD, DB_CLUSTER } from "@config";
import mongoose from "mongoose";

export const dbConnection = {
  url: `mongodb+srv://${DB_HOST}:${DB_PASSWORD}@${DB_CLUSTER}/${DB_DATABASE}`,
  connect: () => mongoose.connect(dbConnection.url),
  disconnect: () => mongoose.connection.close(),
  set: mongoose.set,
};
