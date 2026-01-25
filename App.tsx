
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
  const [isDemo, setIsDemo] = useState(true);

  const hoje = new Date();
  const dataCorte = new Date();
  dataCorte.setDate(hoje.getDate() - 60);

  const addExampleData = useCallback(() => {
    const exemploDiarias: Diaria[] = [
      { id: "120875", nomeCredor: "ANDRE LUIZ DOS SANTOS", datasDeslocamento: "08/01/2026", valor: "69.16", status: "Pendente", motivo: "Fiscalização de agentes regulados", destino: "SÃO JOSÉ DOS CAMPOS" },
      { id: "121110", nomeCredor: "ANDRE LUIZ DOS SANTOS", datasDeslocamento: "09/01/2026 a 10/01/2026", valor: "345.78", status: "Pendente", motivo: "Operação Direção Segura Integrada", destino: "CAMPINAS" },
      { id: "121111", nomeCredor: "ANDRE LUIZ DOS SANTOS", datasDeslocamento: "12/01/2026", valor: "69.16", status: "Pendente", motivo: "Fiscalização e campanha educativa", destino: "SANTOS" }
    ];

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
        dataAprovOrdenador: null
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
        dataAprovOrdenador: null
      }
    ];

    setDiarias(exemploDiarias);
    setTimelineData(exemploTimeline);
    setStats({
      totalDiarias: 3,
      totalValor: 484.10,
      periodoAnalisado: 60,
      servidoresUnicos: 1
    });
    setIsDemo(true);
  }, []);

  useEffect(() => {
    addExampleData();
  }, [addExampleData]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);
    setIsDemo(false);

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
        
        if (h === "DESTINO") {
          colIndices["Destino"] = index;
        }
      }
    });

    if (colIndices["Destino"] === undefined) {
      colIndices["Destino"] = 15; // Coluna P
    }

    const requiredCols = ["Saída Origem", "Data de Pagamento", "Valor à Pagar"];
    const missingCols = requiredCols.filter(col => colIndices[col] === undefined);

    if (missingCols.length > 0) {
      alert("Não foram encontradas todas as colunas necessárias. Colunas faltantes: " + missingCols.join(", "));
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
      try {
        const saidaOrigemStr = row[colIndices["Saída Origem"]];
        const chegadaDestinoStr = row[colIndices["Chegada Destino"]];
        const dataPagamento = row[colIndices["Data de Pagamento"]];
        const valorStr = row[colIndices["Valor à Pagar"]];
        const totalPagoStr = row[colIndices["Total Pago"]];
        const id = row[colIndices["Id"]] || "N/A";
        const nomeCredor = row[colIndices["Nome Credor"]] || "N/A";
        const status = row[colIndices["Status"]] || "N/A";
        const motivo = row[colIndices["Motivo"]] || "N/A";
        const destinoValue = row[colIndices["Destino"]] || "N/A";
        const dataSolicitacaoStr = row[colIndices["Data Solicitação"]];
        const dataAprovChefeStr = row[colIndices["Data Aprovação Chefe Imediato"]];
        const dataAprovOrdenadorStr = row[colIndices["Data Aprovação Ordenador"]];

        const saidaOrigemDate = parseDate(saidaOrigemStr);

        if (saidaOrigemDate && saidaOrigemDate >= sixtyDaysAgo) {
          let naoPago = false;
          if (!dataPagamento || 
              dataPagamento.toString().trim() === "" || 
              dataPagamento.toString().trim().toUpperCase() === "N/A") {
            
            if (totalPagoStr !== undefined && totalPagoStr !== null) {
              const totalPago = parseFloat(totalPagoStr.toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
              if (totalPago === 0 || isNaN(totalPago)) {
                naoPago = true;
              }
            } else {
              naoPago = true;
            }
          }

          if (naoPago) {
            let valor = 0;
            if (valorStr) {
              const valorNum = parseFloat(valorStr.toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
              if (!isNaN(valorNum)) {
                valor = valorNum;
                valorTotal += valorNum;
              }
            }

            let datasDeslocamento = "";
            if (saidaOrigemStr) {
              const saidaDate = parseDate(saidaOrigemStr);
              const chegadaDate = parseDate(chegadaDestinoStr);
              const saidaFormatada = saidaDate ? formatDate(saidaDate) : saidaOrigemStr;
              if (chegadaDate) {
                const chegadaFormatada = formatDate(chegadaDate);
                datasDeslocamento = saidaFormatada === chegadaFormatada ? saidaFormatada : `${saidaFormatada} a ${chegadaFormatada}`;
              } else {
                datasDeslocamento = saidaFormatada;
              }
            }

            filteredDiarias.push({
              id: id.toString(),
              nomeCredor: nomeCredor.toString(),
              datasDeslocamento,
              valor: valor.toFixed(2),
              status: status.toString(),
              motivo: motivo.toString().length > 50 ? motivo.toString().substring(0, 50) + "..." : motivo.toString(),
              destino: destinoValue.toString(),
              saidaOrigemDate
            });

            credoresSet.add(nomeCredor.toString());

            filteredTimeline.push({
              id: id.toString(),
              nomeCredor: nomeCredor.toString(),
              datasDeslocamento,
              valor: valor.toFixed(2),
              status: status.toString(),
              motivo: motivo.toString(),
              destino: destinoValue.toString(),
              dataSolicitacao: parseDate(dataSolicitacaoStr),
              dataAprovChefe: parseDate(dataAprovChefeStr),
              dataAprovOrdenador: parseDate(dataAprovOrdenadorStr),
              saidaOrigemDate
            });
          }
        }
      } catch (err) {
        console.error("Erro na linha:", err);
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
        
        <div className="mt-5 bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-lg flex items-start gap-3 text-left max-w-2xl mx-auto">
          <i className="fas fa-info-circle text-xl mt-0.5"></i>
          <div className="text-sm">
            <strong>Análise Automatizada:</strong> O sistema identifica diárias dos últimos <strong>60 dias</strong> pendentes de pagamento. A cidade de destino é extraída automaticamente da <strong>Coluna P</strong>.
          </div>
        </div>
      </section>

      {loading && (
        <div className="text-center py-10">
          <i className="fas fa-spinner fa-spin text-5xl text-[#FF2800] mb-4"></i>
          <p className="font-medium">Cruzando dados da planilha...</p>
        </div>
      )}

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
                    <th className="p-4 text-sm font-bold uppercase tracking-wider">ID</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider">Cidade Destino</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider">Datas</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider">Valor</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-center">Status</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider">Motivo</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {diarias.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-12 text-gray-400">
                        <i className="fas fa-check-double text-green-500 text-5xl mb-3 block"></i>
                        Nenhuma pendência encontrada no período.
                      </td>
                    </tr>
                  ) : (
                    diarias.map((diaria, idx) => (
                      <tr key={diaria.id + idx} className={`hover:bg-gray-50 transition-colors border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="p-4 font-mono text-sm">{diaria.id}</td>
                        <td className="p-4 font-bold text-gray-800 uppercase text-xs">{diaria.destino}</td>
                        <td className="p-4 text-xs whitespace-nowrap">{diaria.datasDeslocamento}</td>
                        <td className="p-4 font-semibold text-sm">R$ {diaria.valor}</td>
                        <td className="p-4 text-center">
                          <span className="bg-red-50 text-red-700 px-2 py-1 rounded text-[10px] font-bold uppercase border border-red-100">
                            Pendente
                          </span>
                        </td>
                        <td className="p-4 text-[11px] text-gray-500 leading-tight">{diaria.motivo}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h3 className="text-2xl font-bold flex items-center gap-2">
                        <i className="fas fa-project-diagram text-[#FF2800]"></i> Fluxo de Aprovação Atual
                    </h3>
                    <p className="text-gray-500 text-sm mt-1">Rastreamento do estágio de aprovação para os 8 registros mais recentes.</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> Concluído</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#FF2800]"></span> Atual</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-300"></span> Pendente</span>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {timelineData.length === 0 ? (
                <div className="col-span-full text-center py-10 bg-white rounded-xl border border-gray-200 text-gray-400">
                  <p>Aguardando processamento de dados para gerar o fluxo.</p>
                </div>
              ) : (
                timelineData
                  .sort((a, b) => (b.saidaOrigemDate?.getTime() || 0) - (a.saidaOrigemDate?.getTime() || 0))
                  .slice(0, 8)
                  .map((item, index) => (
                    <WorkflowCard key={item.id + index} item={item} />
                  ))
              )}
            </div>
          </section>
        </div>
      )}

      <footer className="mt-12 pt-8 text-center text-gray-400 border-t border-gray-200 text-xs">
        <p>Sistema de Monitoramento DETRAN/SP &copy; 2025 | Análise de 60 Dias | Cidade via Coluna P</p>
      </footer>
    </div>
  );
};

const StatCard: React.FC<{ icon: string, label: string, value: string | number }> = ({ icon, label, value }) => (
  <div className="bg-white rounded-xl p-6 text-center border-b-4 border-[#FF2800] shadow-sm transition-all hover:shadow-md border-x border-t border-gray-100">
    <div className="text-2xl text-[#FF2800] mb-2"><i className={`fas ${icon}`}></i></div>
    <div className="text-3xl font-bold text-gray-900 my-1">{value}</div>
    <div className="text-xs text-gray-400 font-bold uppercase tracking-widest">{label}</div>
  </div>
);

const WorkflowCard: React.FC<{ item: TimelineItem }> = ({ item }) => {
  const steps = [
    { label: 'Solicitação', date: item.dataSolicitacao, icon: 'fa-paper-plane' },
    { label: 'Chefia', date: item.dataAprovChefe, icon: 'fa-user-check' },
    { label: 'Ordenador', date: item.dataAprovOrdenador, icon: 'fa-stamp' }
  ];

  // Calculate percentage for progress fill
  let completedSteps = 0;
  if (item.dataSolicitacao) completedSteps = 1;
  if (item.dataAprovChefe) completedSteps = 2;
  if (item.dataAprovOrdenador) completedSteps = 3;
  
  const fillWidth = completedSteps === 0 ? '0%' : completedSteps === 1 ? '0%' : completedSteps === 2 ? '50%' : '100%';
  const totalDays = calculateDaysBetween(item.dataSolicitacao, item.dataAprovOrdenador || new Date());

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 transition-all hover:border-[#FF2800]/30 hover:shadow-lg group">
      <div className="flex justify-between items-start mb-6">
        <div>
            <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase tracking-tighter">ID {item.id}</span>
                <span className="text-[10px] font-bold bg-red-50 text-[#FF2800] px-1.5 py-0.5 rounded uppercase">R$ {item.valor}</span>
            </div>
            <h4 className="text-sm font-bold uppercase text-gray-800">{item.destino}</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">{item.datasDeslocamento}</p>
        </div>
        <div className="text-right">
            <span className="text-[10px] font-bold text-gray-500 block">DURAÇÃO</span>
            <span className="text-sm font-bold text-[#FF2800]">{totalDays || 0} DIAS</span>
        </div>
      </div>

      <div className="relative mb-10 mt-8">
        {/* Progress Background Line */}
        <div className="progress-line h-1 mx-6">
            <div className="progress-fill" style={{ width: fillWidth }}></div>
        </div>
        
        {/* Step Markers */}
        <div className="relative z-10 flex justify-between">
            {steps.map((step, i) => {
                const isComplete = !!step.date;
                const isCurrent = (completedSteps === i);
                
                let dotClass = "bg-white border-2 ";
                let labelClass = "text-[9px] font-bold uppercase mt-2 text-center absolute -bottom-8 left-1/2 -translate-x-1/2 w-20 ";
                
                if (isComplete) {
                    dotClass += "border-green-500 text-green-500";
                    labelClass += "text-green-600";
                } else if (isCurrent) {
                    dotClass += "border-[#FF2800] text-[#FF2800] shadow-[0_0_8px_rgba(255,40,0,0.3)] scale-110";
                    labelClass += "text-[#FF2800]";
                } else {
                    dotClass += "border-gray-200 text-gray-300";
                    labelClass += "text-gray-400";
                }

                return (
                    <div key={i} className="flex flex-col items-center relative">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all duration-300 ${dotClass}`}>
                            <i className={`fas ${isComplete ? 'fa-check' : step.icon}`}></i>
                        </div>
                        <div className={labelClass}>
                            {step.label}
                            {step.date && <span className="block font-normal text-gray-400 normal-case">{formatDate(step.date)}</span>}
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
      
      <div className="mt-12 pt-4 border-t border-gray-50 flex items-center justify-between">
          <div className="text-[10px] font-medium text-gray-400 italic truncate max-w-[70%]">
              <i className="fas fa-info-circle mr-1"></i> {item.motivo}
          </div>
          <button className="text-[10px] font-bold text-[#FF2800] hover:underline uppercase">Detalhes</button>
      </div>
    </div>
  );
};

export default App;
