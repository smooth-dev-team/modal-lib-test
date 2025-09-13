import React from "react";
import { useSheetUrlState } from "../../hooks/useSheetUrlState";
export default function Main() {
    const { setModalPanel } = useSheetUrlState();

    return (
        <div style={{ padding: 12 }}>
            settings / main Lorem ipsum dolor sit amet consectetur, adipisicing elit. Error labore
            aperiam quidem quibusdam consequuntur hic, excepturi id fugit? Doloribus praesentium
            odit eos esse possimus iste enim eligendi amet perferendis assumenda?
            <button onClick={() => setModalPanel("test", "/a")}>Open settings (root) (push)</button>
        </div>
    );
}
