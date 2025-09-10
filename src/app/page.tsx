import { SheetDebug } from "@/sheet/components/SheetDebug";
import { SheetRoot } from "@/sheet/components/SheetRoot";
import { Suspense } from "react";

export default function Home() {
    return (
        <main style={{ padding: 24 }}>
            <Suspense fallback={null}>
                <SheetDebug />
                <SheetRoot />
            </Suspense>
        </main>
    );
}
