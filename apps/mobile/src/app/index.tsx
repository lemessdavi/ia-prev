import { Redirect, type Href } from "expo-router";
import { useOperatorApp } from "@/context/operatorAppContext";

export default function Index() {
  const { isAuthenticated } = useOperatorApp();
  const target = isAuthenticated ? ("/(tabs)" as Href) : "/login";
  return <Redirect href={target} />;
}
