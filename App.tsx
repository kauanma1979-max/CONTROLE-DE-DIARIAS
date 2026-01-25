
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

      <section className="bg-[#F5F5F5] rounded-xl p-8 mb-8 text-center shadow-lg border-2 border-dashed border-[#FF2800]">
        <h2 className="text-2xl font-bold mb-2">
          <i className="fas fa-file-upload mr-2 text-[#FF2800]"></i> Carregar Planilha de Diárias
        </h2>
        <p className="mb-4 text-gray-600">Faça upload do arquivo Excel para análise automática</p>
        
        <label htmlFor="fileInput" className="inline-flex items-center gap-2 bg-[#FF2800] text-white px-6 py-4 rounded-lg cursor-pointer text-lg font-semibold transition-all hover:-translate-y-1 hover:shadow-[0_5px_15px_rgba(255,40,0,0.3)]">
          <i className="fas fa-file-excel text-xl"></i> Selecionar Arquivo Excel
        </label>
        <input type="file" id="fileInput" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
        
        <div className="mt-4 text-gray-500 italic font-medium">{fileName}</div>
        
        <div className="mt-5 bg-[#e7f3ff] border border-[#b6d4fe] text-[#084298] p-4 rounded-lg flex items-start gap-3 text-left">
          <i className="fas fa-info-circle text-2xl mt-1"></i>
          <div>
            <strong>Importante:</strong> O sistema analisará automaticamente as diárias dos últimos <strong>60 dias</strong> que constam como não pagas (coluna "Data de Pagamento" vazia ou com "N/A").
          </div>
        </div>
      </section>

      {loading && (
        <div className="text-center py-10">
          <i className="fas fa-spinner fa-spin text-5xl text-[#FF2800] mb-4"></i>
          <p>Processando planilha...</p>
        </div>
      )}

      {!loading && (
        <div id="resultsSection">
          <div className="bg-[#f8f9fa] border-l-4 border-[#FF2800] p-5 rounded-lg mb-8 shadow-sm">
            <h3 className="text-xl font-bold mb-2"><i className="fas fa-calendar-check mr-2 text-[#FF2800]"></i> Período Analisado</h3>
            <p>Analisando diárias dos últimos <strong>60 dias</strong> a partir de <strong>{formatDateComplete(hoje)}</strong>.</p>
            <p>Data de corte: <strong>{formatDateComplete(dataCorte)}</strong></p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <StatCard icon="fa-calendar-times" label="Diárias Não Pagas" value={stats.totalDiarias} />
            <StatCard icon="fa-money-bill-wave" label="Valor Total Pendente" value={`R$ ${stats.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
            <StatCard icon="fa-calendar-alt" label="Dias Analisados" value={stats.periodoAnalisado} />
          </div>

          <section className="mb-12">
            <h3 className="text-3xl font-bold mb-5 pb-2 border-b-2 border-[#FF2800] flex items-center gap-2">
              <i className="fas fa-list text-[#FF2800]"></i> Diárias Não Pagas (Últimos 60 dias)
            </h3>
            <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#FF2800] text-white">
                  <tr>
                    <th className="p-4 uppercase text-sm tracking-wider">ID</th>
                    <th className="p-4 uppercase text-sm tracking-wider">Cidade Destino</th>
                    <th className="p-4 uppercase text-sm tracking-wider">Datas do Deslocamento</th>
                    <th className="p-4 uppercase text-sm tracking-wider">Valor (R$)</th>
                    <th className="p-4 uppercase text-sm tracking-wider">Status Pagamento</th>
                    <th className="p-4 uppercase text-sm tracking-wider">Motivo</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {diarias.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-12 text-gray-400">
                        <i className="fas fa-check-circle text-green-600 text-4xl mb-3 block"></i>
                        Nenhuma diária não paga encontrada nos últimos 60 dias!
                      </td>
                    </tr>
                  ) : (
                    diarias.map((diaria, idx) => (
                      <tr key={diaria.id + idx} className={`hover:bg-[#ffe8e4] transition-colors border-b border-gray-100 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                        <td className="p-3 font-medium font-mono">{diaria.id}</td>
                        <td className="p-3 font-bold text-gray-800 uppercase text-xs">{diaria.destino}</td>
                        <td className="p-3 text-xs">{diaria.datasDeslocamento}</td>
                        <td className="p-3 font-semibold">R$ {diaria.valor}</td>
                        <td className="p-3">
                          <span className="bg-[#ffcccc] text-[#cc0000] px-3 py-1 rounded-md font-bold text-[10px] uppercase">
                            <i className="fas fa-clock mr-1"></i> Pendente
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-gray-600 italic leading-tight">{diaria.motivo}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
            <h3 className="text-3xl font-bold mb-4 pb-2 border-b-2 border-[#FF2800] flex items-center gap-2">
              <i className="fas fa-project-diagram text-[#FF2800]"></i> Fluxo de Aprovações Pendentes
            </h3>
            <p className="mb-6 text-gray-600">Lista completa de rastreamento das etapas de aprovação para todas as solicitações não pagas.</p>
            
            <div className="flex flex-col gap-2">
              {timelineData.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <i className="fas fa-calendar-times text-4xl mb-3"></i>
                  <p>Dados indisponíveis para gerar o fluxo de aprovação.</p>
                </div>
              ) : (
                timelineData
                  .sort((a, b) => (b.saidaOrigemDate?.getTime() || 0) - (a.saidaOrigemDate?.getTime() || 0))
                  .map((item, index) => (
                    <WorkflowCard key={item.id + index} item={item} />
                  ))
              )}
            </div>
          </section>
        </div>
      )}

      <footer className="mt-12 pt-8 text-center text-gray-400 border-t border-gray-200 text-xs">
        <p>Sistema de Controle de Diárias - DETRAN/SP | Filtro: 60 Dias | Destino: Coluna P</p>
        <p className="mt-1 flex justify-center items-center gap-1 uppercase tracking-widest font-bold">
          <i className="fas fa-shield-alt text-[#FF2800]"></i> DETRAN/SP - Monitoramento
        </p>
      </footer>
    </div>
  );
};

const StatCard: React.FC<{ icon: string, label: string, value: string | number }> = ({ icon, label, value }) => (
  <div className="bg-white rounded-xl p-6 text-center border-b-4 border-[#FF2800] shadow-sm transition-transform hover:-translate-y-1 border border-gray-100">
    <div className="text-2xl text-[#FF2800] mb-2"><i className={`fas ${icon}`}></i></div>
    <div className="text-4xl font-black text-gray-800 my-2">{value}</div>
    <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">{label}</div>
  </div>
);

const WorkflowCard: React.FC<{ item: TimelineItem }> = ({ item }) => {
  const steps = [
    { label: 'Solicitação', date: item.dataSolicitacao, icon: 'fa-paper-plane' },
    { label: 'Chefia', date: item.dataAprovChefe, icon: 'fa-user-tie' },
    { label: 'Ordenador', date: item.dataAprovOrdenador, icon: 'fa-stamp' }
  ];

  let completedSteps = 0;
  if (item.dataSolicitacao) completedSteps = 1;
  if (item.dataAprovChefe) completedSteps = 2;
  if (item.dataAprovOrdenador) completedSteps = 3;

  const fillWidth = completedSteps <= 1 ? '0%' : completedSteps === 2 ? '50%' : '100%';

  return (
    <div className="bg-white rounded-md border border-gray-100 px-4 py-2 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center gap-6 hover:border-[#FF2800]/30 group">
      {/* Informações Básicas - Enxuto */}
      <div className="flex-shrink-0 w-full md:w-56">
        <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-gray-400 bg-gray-50 px-1 py-0.5 rounded">#{item.id}</span>
            <span className="text-[8px] font-bold text-[#FF2800] uppercase tracking-tighter">Pendente</span>
        </div>
        <h4 className="font-black text-gray-800 text-[11px] uppercase mt-0.5 truncate">{item.destino}</h4>
        <p className="text-[9px] text-gray-500 font-medium">{item.datasDeslocamento}</p>
      </div>

      {/* Linha do Tempo Centralizada - Muito mais fina */}
      <div className="flex-grow w-full">
        <div className="relative h-12 flex items-center">
          {/* Fundo da Barra - Mais discreta */}
          <div className="absolute left-6 right-6 h-0.5 bg-gray-100 rounded-full z-0">
             <div className="h-full bg-[#FF2800] rounded-full transition-all duration-700 shadow-[0_0_5px_rgba(255,40,0,0.4)]" style={{ width: fillWidth }}></div>
          </div>

          {/* Marcadores - Menores e mais elegantes */}
          <div className="relative w-full flex justify-between z-10">
            {steps.map((step, idx) => {
              const isDone = !!step.date;
              const isCurrent = (completedSteps === idx);
              
              return (
                <div key={idx} className="flex flex-col items-center min-w-[70px]">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] border-2 bg-white transition-all
                    ${isDone ? 'border-green-500 text-green-500' : isCurrent ? 'border-[#FF2800] text-[#FF2800] scale-110 shadow-sm' : 'border-gray-200 text-gray-200'}`}>
                    <i className={`fas ${isDone ? 'fa-check' : step.icon}`}></i>
                  </div>
                  <div className="mt-1 text-center">
                    <span className={`text-[7px] font-black uppercase block leading-none ${isDone ? 'text-green-600' : isCurrent ? 'text-[#FF2800]' : 'text-gray-300'}`}>
                      {step.label}
                    </span>
                    <span className="text-[7px] text-gray-400 font-mono leading-tight">{step.date ? formatDate(step.date) : '--/--'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Financeiro e Status - Direto ao ponto */}
      <div className="flex-shrink-0 text-right min-w-[120px] border-l border-gray-50 pl-6 hidden md:block">
        <div className="text-sm font-black text-gray-900 leading-none mb-1">R$ {item.valor}</div>
        <div className="text-[8px] text-gray-400 italic truncate max-w-[120px] leading-tight">
            {item.motivo}
        </div>
      </div>
      
      {/* Mobile Value Row */}
      <div className="md:hidden w-full flex justify-between items-center pt-1 border-t border-gray-50">
          <div className="text-[8px] text-gray-400 italic truncate flex-grow mr-4">{item.motivo}</div>
          <div className="text-xs font-black text-gray-900 whitespace-nowrap">R$ {item.valor}</div>
      </div>
    </div>
  );
};

export default App;
