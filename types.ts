
export interface Diaria {
  id: string;
  nomeCredor: string;
  datasDeslocamento: string;
  valor: string;
  status: string;
  motivo: string;
  destino: string; // Adicionado campo destino
  saidaOrigemDate?: Date | null;
}

export interface TimelineItem extends Diaria {
  dataSolicitacao: Date | null;
  dataAprovChefe: Date | null;
  dataAprovOrdenador: Date | null;
}

export interface Stats {
  totalDiarias: number;
  totalValor: number;
  periodoAnalisado: number;
  servidoresUnicos: number;
}
