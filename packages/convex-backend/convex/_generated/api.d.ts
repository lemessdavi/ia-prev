/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminWaba from "../adminWaba.js";
import type * as aiProfiles from "../aiProfiles.js";
import type * as auth from "../auth.js";
import type * as authNode from "../authNode.js";
import type * as chatDomain from "../chatDomain.js";
import type * as coreAuth from "../coreAuth.js";
import type * as coreErrors from "../coreErrors.js";
import type * as coreInput from "../coreInput.js";
import type * as corePassword from "../corePassword.js";
import type * as coreValidators from "../coreValidators.js";
import type * as http from "../http.js";
import type * as n8nBridge from "../n8nBridge.js";
import type * as n8nBridgeNode from "../n8nBridgeNode.js";
import type * as seed from "../seed.js";
import type * as seedNode from "../seedNode.js";
import type * as server from "../server.js";
import type * as tenants from "../tenants.js";
import type * as testing from "../testing.js";
import type * as users from "../users.js";
import type * as usersNode from "../usersNode.js";
import type * as wabaWebhook from "../wabaWebhook.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminWaba: typeof adminWaba;
  aiProfiles: typeof aiProfiles;
  auth: typeof auth;
  authNode: typeof authNode;
  chatDomain: typeof chatDomain;
  coreAuth: typeof coreAuth;
  coreErrors: typeof coreErrors;
  coreInput: typeof coreInput;
  corePassword: typeof corePassword;
  coreValidators: typeof coreValidators;
  http: typeof http;
  n8nBridge: typeof n8nBridge;
  n8nBridgeNode: typeof n8nBridgeNode;
  seed: typeof seed;
  seedNode: typeof seedNode;
  server: typeof server;
  tenants: typeof tenants;
  testing: typeof testing;
  users: typeof users;
  usersNode: typeof usersNode;
  wabaWebhook: typeof wabaWebhook;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
