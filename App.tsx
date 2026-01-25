
import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'https://esm.sh/xlsx';
import { Diaria, TimelineItem, Stats } from './types';
import { parseDate, formatDate, formatDateComplete, calculateDaysBetween } from './utils';

const App: React.FC = () => {
  const [diarias, setDiarias] = useState<Diaria[]>([]);
  const [timelineData, setTimelineData] = useState<TimelineItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalDiarias: 0,
    totalValor: 0,
    periodoAnalisado: 60,
    servidoresUnicos: 0
  });
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("Nenhum arquivo selecionado");

  const hoje = new Date();
  const dataCorte = new Date();
  dataCorte.setDate(hoje.getDate() - 60);

  const addExampleData = useCallback(() => {
    const exemploTimeline: TimelineItem[] = [
      {
        id: "120875",
        nomeCredor: "ANDRE LUIZ DOS SANTOS",
        datasDeslocamento: "08/01/2026",
        valor: "69.16",
        status: "Não Pago",
        motivo: "Fiscalização de agentes regulados",
        destino: "SÃO JOSÉ DOS CAMPOS",
        dataSolicitacao: new Date(2026, 0, 8),
        dataAprovChefe: null,
        dataAprovOrdenador: null,
        saidaOrigemDate: new Date(2026, 0, 8)
      },
      {
        id: "121110",
        nomeCredor: "ANDRE LUIZ DOS SANTOS",
        datasDeslocamento: "09/01/2026 a 10/01/2026",
        valor: "345.78",
        status: "Não Pago",
        motivo: "Operação Direção Segura Integrada",
        destino: "CAMPINAS",
        dataSolicitacao: new Date(2026, 0, 11),
        dataAprovChefe: new Date(2026, 0, 11),
        dataAprovOrdenador: null,
        saidaOrigemDate: new Date(2026, 0, 11)
      }
    ];

    setDiarias([
      { ...exemploTimeline[0], status: "Pendente" },
      { ...exemploTimeline[1], status: "Pendente" }
    ]);
    setTimelineData(exemploTimeline);
    setStats({
      totalDiarias: 2,
      totalValor: 414.94,
      periodoAnalisado: 60,
      servidoresUnicos: 1
    });
  }, []);

  useEffect(() => {
    addExampleData();
  }, [addExampleData]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        processExcelData(jsonData);
      } catch (error) {
        console.error("Erro ao processar o arquivo:", error);
        alert("Erro ao processar o arquivo. Verifique se é um arquivo Excel válido.");
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processExcelData = (data: any[][]) => {
    if (data.length === 0) {
      setLoading(false);
      return;
    }

    const headers = data[0];
    const colIndices: { [key: string]: number } = {};
    
    headers.forEach((header, index) => {
      if (header) {
        const h = header.toString().trim().toUpperCase();
        if (h === "ID") colIndices["Id"] = index;
        if (h.includes("NOME CREDOR")) colIndices["Nome Credor"] = index;
        if (h === "SAÍDA ORIGEM") colIndices["Saída Origem"] = index;
        if (h === "CHEGADA DESTINO") colIndices["Chegada Destino"] = index;
        if (h === "DATA DE PAGAMENTO") colIndices["Data de Pagamento"] = index;
        if (h.includes("VALOR À PAGAR")) colIndices["Valor à Pagar"] = index;
        if (h === "DATA SOLICITAÇÃO") colIndices["Data Solicitação"] = index;
        if (h.includes("CHEFE IMEDIATO")) colIndices["Data Aprovação Chefe Imediato"] = index;
        if (h.includes("ORDENADOR")) colIndices["Data Aprovação Ordenador"] = index;
        if (h === "STATUS") colIndices["Status"] = index;
        if (h === "MOTIVO") colIndices["Motivo"] = index;
        if (h.includes("TOTAL PAGO")) colIndices["Total Pago"] = index;
        if (h === "DESTINO") colIndices["Destino"] = index;
      }
    });

    if (colIndices["Destino"] === undefined) colIndices["Destino"] = 15;

    const requiredCols = ["Saída Origem", "Data de Pagamento", "Valor à Pagar"];
    const missingCols = requiredCols.filter(col => colIndices[col] === undefined);

    if (missingCols.length > 0) {
      alert("Não foram encontradas todas as colunas necessárias.");
      setLoading(false);
      return;
    }

    const rows = data.slice(1).filter(row => row && row.length > 0);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(new Date().getDate() - 60);

    const filteredDiarias: Diaria[] = [];
    const filteredTimeline: TimelineItem[] = [];
    let valorTotal = 0;
    const credoresSet = new Set<string>();

    rows.forEach(row => {
      const saidaOrigemStr = row[colIndices["Saída Origem"]];
      const dataPagamento = row[colIndices["Data de Pagamento"]];
      const valorStr = row[colIndices["Valor à Pagar"]];
      const saidaOrigemDate = parseDate(saidaOrigemStr);

      if (saidaOrigemDate && saidaOrigemDate >= sixtyDaysAgo) {
        const naoPago = !dataPagamento || dataPagamento.toString().trim() === "" || dataPagamento.toString().trim().toUpperCase() === "N/A";

        if (naoPago) {
          const valorNum = parseFloat(valorStr?.toString().replace(/[^\d,.-]/g, '').replace(',', '.') || "0");
          valorTotal += valorNum;

          const diariaBase = {
            id: row[colIndices["Id"]]?.toString() || "N/A",
            nomeCredor: row[colIndices["Nome Credor"]]?.toString() || "N/A",
            datasDeslocamento: formatDate(saidaOrigemDate),
            valor: valorNum.toFixed(2),
            status: row[colIndices["Status"]]?.toString() || "N/A",
            motivo: row[colIndices["Motivo"]]?.toString() || "N/A",
            destino: row[colIndices["Destino"]]?.toString() || "N/A",
            saidaOrigemDate
          };

          filteredDiarias.push(diariaBase);
          credoresSet.add(diariaBase.nomeCredor);
          filteredTimeline.push({
            ...diariaBase,
            dataSolicitacao: parseDate(row[colIndices["Data Solicitação"]]),
            dataAprovChefe: parseDate(row[colIndices["Data Aprovação Chefe Imediato"]]),
            dataAprovOrdenador: parseDate(row[colIndices["Data Aprovação Ordenador"]])
          });
        }
      }
    });

    setDiarias(filteredDiarias);
    setTimelineData(filteredTimeline);
    setStats({
      totalDiarias: filteredDiarias.length,
      totalValor: valorTotal,
      periodoAnalisado: 60,
      servidoresUnicos: credoresSet.size
    });
    setLoading(false);
  };

  return (
    <div className="max-w-[1200px] mx-auto p-5 pb-12">
      <header className="text-center py-8 border-b-[3px] border-[#FF2800] mb-8 bg-gradient-to-br from-white to-[#fff5f3]">
        <h1 className="text-[#FF2800] text-4xl font-bold mb-2">
          <i className="fas fa-car mr-2"></i> Controle de Diárias
        </h1>
        <p className="text-black text-xl font-medium">Sistema de análise de diárias - DETRAN/SP</p>
      </header>

      <section className="bg-white rounded-xl p-8 mb-8 text-center shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold mb-2">
          <i className="fas fa-file-upload mr-2 text-[#FF2800]"></i> Carregar Planilha de Diárias
        </h2>
        <p className="mb-4 text-gray-600">Faça upload do arquivo Excel para análise dos últimos 60 dias</p>
        
        <label htmlFor="fileInput" className="inline-flex items-center gap-2 bg-[#FF2800] text-white px-6 py-4 rounded-lg cursor-pointer text-lg font-semibold transition-all hover:-translate-y-1 hover:shadow-[0_5px_15px_rgba(255,40,0,0.3)]">
          <i className="fas fa-file-excel text-xl"></i> Selecionar Arquivo Excel
        </label>
        <input type="file" id="fileInput" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
        
        <div className="mt-4 text-gray-500 italic font-medium">{fileName}</div>
      </section>

      {!loading && (
        <div id="resultsSection">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <StatCard icon="fa-calendar-times" label="Diárias Não Pagas" value={stats.totalDiarias} />
            <StatCard icon="fa-money-bill-wave" label="Valor Total Pendente" value={`R$ ${stats.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
            <StatCard icon="fa-calendar-alt" label="Dias Analisados" value={stats.periodoAnalisado} />
          </div>

          <section className="mb-12 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <i className="fas fa-table text-[#FF2800]"></i> Relatório de Pendências (60 dias)
                </h3>
                <span className="text-sm text-gray-500 italic">Corte: {formatDate(dataCorte)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#FF2800] text-white">
                  <tr>
                    <th className="p-4 text-xs font-bold uppercase">ID</th>
                    <th className="p-4 text-xs font-bold uppercase">Cidade Destino</th>
                    <th className="p-4 text-xs font-bold uppercase">Datas</th>
                    <th className="p-4 text-xs font-bold uppercase">Valor</th>
                    <th className="p-4 text-xs font-bold uppercase text-center">Status</th>
                    <th className="p-4 text-xs font-bold uppercase">Motivo</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {diarias.map((diaria, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-4 font-mono text-xs">{diaria.id}</td>
                      <td className="p-4 font-bold text-gray-800 uppercase text-xs">{diaria.destino}</td>
                      <td className="p-4 text-xs">{diaria.datasDeslocamento}</td>
                      <td className="p-4 font-semibold text-xs text-red-600">R$ {diaria.valor}</td>
                      <td className="p-4 text-center">
                        <span className="bg-red-50 text-red-700 px-2 py-1 rounded text-[10px] font-bold uppercase">Pendente</span>
                      </td>
                      <td className="p-4 text-[10px] text-gray-500 leading-tight">{diaria.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-12">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <i className="fas fa-project-diagram text-[#FF2800]"></i> Painel de Rastreamento de Aprovação
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {timelineData.slice(0, 8).map((item, index) => (
                <WorkflowCard key={index} item={item} />
              ))}
            </div>
          </section>
        </div>
      )}

      <footer className="mt-12 pt-8 text-center text-gray-400 border-t border-gray-200 text-xs uppercase tracking-widest font-bold">
        <i className="fas fa-shield-alt mr-2"></i> DETRAN/SP - Monitoramento de Diárias
      </footer>
    </div>
  );
};

const StatCard: React.FC<{ icon: string, label: string, value: string | number }> = ({ icon, label, value }) => (
  <div className="bg-white rounded-xl p-6 text-center border-b-4 border-[#FF2800] shadow-sm border-x border-t border-gray-100">
    <div className="text-2xl text-[#FF2800] mb-2"><i className={`fas ${icon}`}></i></div>
    <div className="text-3xl font-bold text-gray-900 my-1">{value}</div>
    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{label}</div>
  </div>
);

const WorkflowCard: React.FC<{ item: TimelineItem }> = ({ item }) => {
  const steps = [
    { label: 'Solicitação', date: item.dataSolicitacao, icon: 'fa-paper-plane' },
    { label: 'Chefia', date: item.dataAprovChefe, icon: 'fa-user-check' },
    { label: 'Ordenador', date: item.dataAprovOrdenador, icon: 'fa-stamp' }
  ];

  let currentStep = 0;
  if (item.dataSolicitacao) currentStep = 1;
  if (item.dataAprovChefe) currentStep = 2;
  if (item.dataAprovOrdenador) currentStep = 3;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:border-[#FF2800]/50 transition-all">
      <div className="flex justify-between items-center mb-6">
        <div>
            <span className="text-[9px] font-black bg-gray-100 px-2 py-0.5 rounded text-gray-500 uppercase">PROCESSO {item.id}</span>
            <h4 className="text-sm font-bold uppercase text-gray-800 mt-1">{item.destino}</h4>
        </div>
        <div className="text-right">
            <span className="text-xs font-black text-red-600">R$ {item.valor}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-2 py-4 bg-gray-50 rounded-lg">
        {steps.map((step, i) => {
          const isDone = !!step.date;
          const isCurrent = currentStep === i;
          
          return (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center flex-1 relative">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs transition-all z-10
                  ${isDone ? 'bg-green-500 text-white shadow-lg shadow-green-100' : 
                    isCurrent ? 'bg-[#FF2800] text-white pulse-active' : 'bg-gray-200 text-gray-400'}`}>
                  <i className={`fas ${isDone ? 'fa-check' : step.icon}`}></i>
                </div>
                <div className="mt-2 text-center">
                    <span className={`text-[9px] font-bold block uppercase ${isDone ? 'text-green-600' : isCurrent ? 'text-[#FF2800]' : 'text-gray-400'}`}>
                        {step.label}
                    </span>
                    <span className="text-[8px] text-gray-400 font-mono">{step.date ? formatDate(step.date) : '--/--/--'}</span>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="flex-shrink-0 text-gray-300">
                    <i className="fas fa-chevron-right text-[10px]"></i>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      
      <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
          <span className="text-[9px] text-gray-400 italic truncate max-w-[80%]">
              <i className="fas fa-info-circle mr-1"></i> {item.motivo}
          </span>
      </div>
    </div>
  );
};

export default App;
