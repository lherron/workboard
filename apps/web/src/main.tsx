import { ThemeProvider } from "@/components/ThemeProvider";
import { ConciergeProvider } from "@/components/concierge";
import React from "react";
import ReactDOM from "react-dom/client";
import { Router } from "wouter";
import { AppRoutes } from "./routes";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<ThemeProvider>
			<ConciergeProvider>
				<Router>
					<AppRoutes />
				</Router>
			</ConciergeProvider>
		</ThemeProvider>
	</React.StrictMode>,
);
