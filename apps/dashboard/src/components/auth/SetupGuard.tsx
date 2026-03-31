import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { checkSetup } from "../lib/api";

export function SetupGuard({ children }: { children: React.ReactNode }) {
	const navigate = useNavigate();
	const [checking, setChecking] = useState(true);

	useEffect(() => {
		checkSetup()
			.then((isSetup) => {
				if (isSetup) {
					navigate("/login", { replace: true });
				}
				setChecking(false);
			})
			.catch(() => setChecking(false));
	}, [navigate]);

	if (checking) return null;
	return <>{children}</>;
}
