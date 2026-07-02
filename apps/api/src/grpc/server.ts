import {
  AdminService,
  AuthService,
  BookmarksService,
  CommentsService,
  FeedService,
  FollowsService,
  LikesService,
  NotificationsService,
  PostsService,
  SearchService,
  UsersService,
} from "@chirp/proto";
import {
  Metadata,
  Server,
  ServerCredentials,
  type UntypedHandleCall,
} from "@grpc/grpc-js";
import { adaptService } from "@protobuf-ts/grpc-backend";
import { readFileSync } from "node:fs";
import { TRACE_ID_METADATA_KEY } from "../middleware/request-context";
import { withTracing } from "../middleware/handler-wrapper";
import { adminHandler } from "./handlers/admin.handler";
import { authHandler } from "./handlers/auth.handler";
import { bookmarksHandler } from "./handlers/bookmarks.handler";
import { commentsHandler } from "./handlers/comments.handler";
import { feedHandler } from "./handlers/feed.handler";
import { followsHandler } from "./handlers/follows.handler";
import { likesHandler } from "./handlers/likes.handler";
import { notificationsHandler } from "./handlers/notifications.handler";
import { postsHandler } from "./handlers/posts.handler";
import { searchHandler } from "./handlers/search.handler";
import { usersHandler } from "./handlers/users.handler";

/** Attach trace ID to gRPC response metadata for client observability. */
function wrapWithTraceMetadata(
  originalFn: UntypedHandleCall,
): UntypedHandleCall {
  return (call, callback) => {
    const wrappedCallback: typeof callback = (err, response) => {
      const traceId =
        response && typeof response === "object" && "__traceId" in response
          ? String((response as { __traceId?: string }).__traceId)
          : undefined;

      if (traceId) {
        const metadata = new Metadata();
        metadata.set(TRACE_ID_METADATA_KEY, traceId);
        call.sendMetadata(metadata);
      }

      callback(err, response);
    };

    originalFn(call, wrappedCallback);
  };
}

function registerService(
  server: Server,
  service: any,
  handler: any,
  serviceName: string,
) {
  const [serviceDef, originalHandlers] = adaptService(
    service,
    withTracing(serviceName, handler),
  );
  const tracedHandlers: Record<string, UntypedHandleCall> = {};

  for (const [name, fn] of Object.entries(originalHandlers)) {
    tracedHandlers[name] = wrapWithTraceMetadata(fn as UntypedHandleCall);
  }

  server.addService(serviceDef, tracedHandlers);
}

export function getGrpcServerCredentials(): typeof ServerCredentials.createInsecure extends () => infer T
  ? T
  : never {
  if (process.env.NODE_ENV !== "production") {
    return ServerCredentials.createInsecure();
  }

  const certChain =
    process.env.GRPC_TLS_CERT_PEM ||
    (process.env.GRPC_TLS_CERT_PATH
      ? readFileSync(process.env.GRPC_TLS_CERT_PATH)
      : undefined);
  const privateKey =
    process.env.GRPC_TLS_KEY_PEM ||
    (process.env.GRPC_TLS_KEY_PATH
      ? readFileSync(process.env.GRPC_TLS_KEY_PATH)
      : undefined);

  if (!certChain || !privateKey) {
    throw new Error(
      "GRPC_TLS_CERT_PEM/GRPC_TLS_CERT_PATH and GRPC_TLS_KEY_PEM/GRPC_TLS_KEY_PATH are required in production",
    );
  }

  return ServerCredentials.createSsl(null, [
    {
      cert_chain: Buffer.isBuffer(certChain)
        ? certChain
        : Buffer.from(certChain),
      private_key: Buffer.isBuffer(privateKey)
        ? privateKey
        : Buffer.from(privateKey),
    },
  ]);
}

export function startGrpcServer(port: number): Promise<Server> {
  const server = new Server();

  registerService(server, AuthService, authHandler, "AuthService");
  registerService(server, PostsService, postsHandler, "PostsService");
  registerService(server, CommentsService, commentsHandler, "CommentsService");
  registerService(server, LikesService, likesHandler, "LikesService");
  registerService(server, FollowsService, followsHandler, "FollowsService");
  registerService(server, FeedService, feedHandler, "FeedService");
  registerService(server, SearchService, searchHandler, "SearchService");
  registerService(server, UsersService, usersHandler, "UsersService");
  registerService(server, AdminService, adminHandler, "AdminService");
  registerService(
    server,
    NotificationsService,
    notificationsHandler,
    "NotificationsService",
  );
  registerService(
    server,
    BookmarksService,
    bookmarksHandler,
    "BookmarksService",
  );

  return new Promise((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${port}`,
      getGrpcServerCredentials(),
      (error, boundPort) => {
        if (error) {
          console.error("Failed to bind gRPC server:", error);
          reject(error);
          return;
        }
        console.log(`   gRPC server bound to port ${boundPort}`);
        resolve(server);
      },
    );
  });
}
