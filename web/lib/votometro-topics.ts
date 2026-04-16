export type VotometroTopicKey =
  | "salud"
  | "paz"
  | "justicia"
  | "pensiones"
  | "economia"
  | "ambiente"
  | "presupuesto"
  | "derechos"
  | "energia"
  | "anticorrupcion"
  | "educacion"
  | "seguridad"
  | "sin-clasificar";

export type VotometroTopic = {
  key: VotometroTopicKey;
  label: string;
};

export const VOTOMETRO_TOPICS: VotometroTopic[] = [
  { key: "salud", label: "Salud" },
  { key: "paz", label: "Paz" },
  { key: "justicia", label: "Justicia" },
  { key: "pensiones", label: "Pensiones" },
  { key: "economia", label: "Economía" },
  { key: "ambiente", label: "Ambiente" },
  { key: "presupuesto", label: "Presupuesto" },
  { key: "derechos", label: "Derechos" },
  { key: "energia", label: "Energía" },
  { key: "anticorrupcion", label: "Anticorrupción" },
  { key: "educacion", label: "Educación" },
  { key: "seguridad", label: "Seguridad" },
  { key: "sin-clasificar", label: "Sin clasificar" },
];

export function getTopicLabel(topicKey?: string | null) {
  return VOTOMETRO_TOPICS.find((topic) => topic.key === topicKey)?.label ?? "Sin clasificar";
}
