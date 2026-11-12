import axios from "axios";
import { IS_MISCONFIGURED_PREVIEW, PREVIEW_CONFIG_ERROR } from "../config";
import { applyAuthHeaders, handleAuth401 } from "./authInterceptor";
import { connectivityService } from "./offline/connectivityService";

axios.interceptors.request.use((reqConfig) => {
    if (IS_MISCONFIGURED_PREVIEW) {
        return Promise.reject(new Error(PREVIEW_CONFIG_ERROR));
    }
    return applyAuthHeaders(reqConfig);
});
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
