"use client";

import { Toast } from "@heroui/react";

const DEFAULT_LOGIN_PATH = "/login";
const UNAUTHORIZED_TOAST_MESSAGE = "登录已过期，请重新登录";
const REDIRECT_DELAY_MS = 1200;

let redirectingToLogin = false;

export class UnauthorizedRedirectError extends Error {
  constructor() {
    super("Unauthorized response, redirecting to login");
    this.name = "UnauthorizedRedirectError";
  }
}

type ClientFetchInit = RequestInit & {
  redirectOnUnauthorized?: boolean;
  loginPath?: string;
};

function buildLoginUrl(loginPath: string) {
  if (typeof window === "undefined") {
    return loginPath;
  }

  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentUrl === loginPath || currentUrl.startsWith(`${loginPath}?`)) {
    return loginPath;
  }

  const redirect = encodeURIComponent(currentUrl);
  return `${loginPath}?redirect=${redirect}`;
}

export function redirectToLogin(loginPath = DEFAULT_LOGIN_PATH) {
  if (typeof window === "undefined" || redirectingToLogin) {
    return;
  }

  redirectingToLogin = true;
  Toast.toast.warning(UNAUTHORIZED_TOAST_MESSAGE);

  window.setTimeout(() => {
    window.location.replace(buildLoginUrl(loginPath));
  }, REDIRECT_DELAY_MS);
}

export function isUnauthorizedRedirectError(error: unknown) {
  return error instanceof UnauthorizedRedirectError;
}

export async function clientFetch(input: RequestInfo | URL, init?: ClientFetchInit) {
  const {
    redirectOnUnauthorized = true,
    loginPath = DEFAULT_LOGIN_PATH,
    ...requestInit
  } = init ?? {};

  const response = await fetch(input, requestInit);

  if (response.status === 401 && redirectOnUnauthorized) {
    redirectToLogin(loginPath);
    throw new UnauthorizedRedirectError();
  }

  return response;
}
