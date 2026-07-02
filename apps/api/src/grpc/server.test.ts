import { afterEach, describe, expect, it } from "vitest";
import { getGrpcServerCredentials } from "./server";

describe("grpc server credentials", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses insecure credentials outside production", () => {
    process.env.NODE_ENV = "development";
    expect(() => getGrpcServerCredentials()).not.toThrow();
  });

  it("requires TLS material in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.GRPC_TLS_CERT_PEM;
    delete process.env.GRPC_TLS_KEY_PEM;
    delete process.env.GRPC_TLS_CERT_PATH;
    delete process.env.GRPC_TLS_KEY_PATH;

    expect(() => getGrpcServerCredentials()).toThrow(
      "GRPC_TLS_CERT_PEM/GRPC_TLS_CERT_PATH and GRPC_TLS_KEY_PEM/GRPC_TLS_KEY_PATH are required in production",
    );
  });
});
