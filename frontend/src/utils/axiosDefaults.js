import axios from "axios";
import { applyAuthHeaders, handleAuth401 } from "./authInterceptor";
import { connectivityService } from "./offline/connectivityService";

axios.interceptors.request.use(applyAuthHeaders);
axios.interceptors.response.use(
    (res) => {
        connectivityService.recordApiSuccess();
        return res;
    },
    (error) => {
        if (error?.response) {
            connectivityService.recordApiSuccess();
        }
        return handleAuth401(error);
    }
);
