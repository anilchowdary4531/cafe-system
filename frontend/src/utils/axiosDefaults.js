import axios from "axios";
import { applyAuthHeaders, handleAuth401 } from "./authInterceptor";

axios.interceptors.request.use(applyAuthHeaders);
axios.interceptors.response.use((res) => res, handleAuth401);

