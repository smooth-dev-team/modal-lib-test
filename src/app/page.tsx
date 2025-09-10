import { SheetDebug } from "@/sheet/components/SheetDebug";
import { SheetRoot } from "@/sheet/components/SheetRoot";

export default function Home() {
    return (
        <main style={{ padding: 24 }}>
            <SheetDebug />
            <SheetRoot />
        </main>
    );
}
