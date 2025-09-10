import { SheetDebug } from "@/sheet/components/SheetDebug";

export default function Home() {
    return (
        <main style={{ padding: 24 }}>
            <h1>Hello World!</h1>
            <p>Use the controls below to open the Sheet and navigate panels.</p>
            <SheetDebug />
        </main>
    );
}
