import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route(
    "/api/getPreSignedUrl",
    "routes/api/getPreSignedUrl/getPreSignedUrl.tsx"
  ),
  route(
    "/api/uploadUsingBinding/:bucket/:fileName",
    "routes/api/uploadUsingBinding/uploadUsingBinding.tsx"
  ),
  route(
    "/api/uploadUsingMultiPart/:bucket/:fileName/:uploadId?/:partNumber?",
    "routes/api/uploadUsingMultiPart/uploadUsingMultiPart.tsx"
  ),
] satisfies RouteConfig;
