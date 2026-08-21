import type { Metadata } from "next";
import MarbleRace3D from "@/components/games/MarbleRace3D";

export const metadata: Metadata = {
  title: "Démo — La grande course",
  robots: { index: false, follow: false },
};

// Preview du jeu en 3D, dans un cadre portrait 9:16 (mode démo, sans compte).
export default function DemoGrandeCourse() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "#05070c",
      }}
    >
      <div className="phone-frame">
        <MarbleRace3D demo />
      </div>
    </div>
  );
}
