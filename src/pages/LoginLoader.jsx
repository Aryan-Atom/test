import axios from "axios";
import React, { useEffect } from "react";
import { useCookies } from "react-cookie";
import { Oval } from "react-loader-spinner";
import { useLocation, useNavigate } from "react-router-dom";
import { redirection } from "../axios/endPoints";
import knoxLogo from "../assets/shared/knox.png";

const LoginLoader = ({ setIsUserAuthenticated, setSSOloginFailed }) => {
  const {
    VITE_APP_ELM_API_SERVER,
    VITE_APP_ELM_PROFILE_TOKEN_NAME,
    VITE_APP_ELM_TOKEN_NAME,
    VITE_APP_ELM_AUTH_TOKEN,
    VITE_APP_ELM_REFRESH_TOKEN,
  } = import.meta.env;
  const navigate = useNavigate();
  const location = useLocation();
  const [cookies, setCookie] = useCookies([VITE_APP_ELM_TOKEN_NAME]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:29282");
    if (location?.pathname !== "/logout") {
      if (
        cookies &&
        cookies[VITE_APP_ELM_TOKEN_NAME] !== undefined &&
        Object.keys(cookies[VITE_APP_ELM_TOKEN_NAME]).length !== 0
      ) {
        setIsUserAuthenticated(true);
        if (location?.pathname) {
          navigate(location?.pathname);
        } else {
          navigate(`${redirection?.ELM_DASHBOARD}`);
        }
      } else {
        ws.onopen = function () {
          ws.send('{"rqtype":"getknoxsso","token":"","data":"KCC40TRAY0055"}');
        };
        ws.onerror = function (event) {
          console.error("Websocket error", event);
          setSSOloginFailed(true);
        };
        ws.onmessage = function (e) {
          const response = JSON.parse(e.data);
          if (response.rpcode === "RETURN_SUCCESS") {
            const encodedUserInfo = JSON.parse(response.data);
            var bodyData = {
              encryptedUserInfo: encodedUserInfo?.userInfo,
              encodedAesKey: encodedUserInfo?.key,
            };

            axios
              .post(VITE_APP_ELM_API_SERVER + "/api/Login/SSOLogin", bodyData)
              .then((response) => {
                setCookie(VITE_APP_ELM_PROFILE_TOKEN_NAME, response?.data, { path: "/" });
                setCookie(VITE_APP_ELM_AUTH_TOKEN, response?.data.token, { path: "/" });
                setCookie(VITE_APP_ELM_REFRESH_TOKEN, response?.data?.refreshToken, {
                  path: "/",
                });
                setCookie(VITE_APP_ELM_TOKEN_NAME, bodyData, { path: "/" });
                setIsUserAuthenticated(true);
                if (location.state?.from) {
                  navigate(location.state.from);
                } else {
                  navigate(`${redirection?.ELM_DASHBOARD}`);
                }
              })
              .catch((error) => {
                console.debug(error);
                setSSOloginFailed(true);
              });
          } else {
            console.debug("Error");
            setSSOloginFailed(true);
          }
        };
        ws.onclose = () => {
          console.info("WebSocket connection closed");
        };
      }
    }
  }, []);

  return (
    <div className="login-container">
      <div className="login_item">
        <div className="circular_1"></div>
        <div className="circular_2"></div>
        <img alt="knox-logo" src={knoxLogo} />
        <Oval
          visible={true}
          height="50"
          width="50"
          color="#188fdf"
          ariaLabel="oval-loading"
          secondaryColor="lightgray"
          wrapperStyle={{}}
          wrapperClass=""
        />
      </div>
    </div>
  );
};

export default LoginLoader;
