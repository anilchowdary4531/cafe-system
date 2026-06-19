import axios from "axios";
import { config } from "../config";

export const api = axios.create({
    baseURL: `${config.API_BASE_URL}/api`,
});
