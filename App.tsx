
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'https://esm.sh/xlsx';
import { Diaria, TimelineItem, Stats } from './types';
import { parseDate, formatDate, formatDateComplete } from './utils';

// --- COMPONENTE AUDITOR COLUNA Y (INCORPORADO) ---
const AuditorView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [data, setData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const parseMoney = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let s = String(val).trim().replace(/[R$\s]/g, '');
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else if (lastDot > lastComma) {
      const parts = s.split('.');
      if (parts[parts.length - 1].length === 2) s = s.replace(/,/g, '');
      else s = s.replace(/\./g, '');
    } else s = s.replace(',', '.');
    const parsed = parseFloat(s);
    return isNaN(parsed) ? 0 : parsed;
  };

  const parseExcelDate = (value: any) => {
    if (!value) return { date: null, str: 'N/A' };
    let jsDate: Date | null = null;
    if (value instanceof Date) jsDate = value;
    else if (typeof value === 'number') {
      jsDate = new Date(Math.round((value - 25569) * 86400 * 1000));
      const offset = jsDate.getTimezoneOffset() * 60000;
      jsDate = new Date(jsDate.getTime() + offset);
    } else if (typeof value === 'string') {
      const parts = value.trim().split(/[-/]/);
      if (parts.length === 3) {
        if (parts[2].length === 4) jsDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        else if (parts[0].length === 4) jsDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
    }
    if (jsDate && !isNaN(jsDate.getTime())) {
      jsDate.setHours(0, 0, 0, 0);
      const day = String(jsDate.getDate()).padStart(2, '0');
      const month = String(jsDate.getMonth() + 1).padStart(2, '0');
      return { date: jsDate, str: `${day}/${month}/${jsDate.getFullYear()}` };
    }
    return { date: null, str: String(value) };
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const workbook = XLSX.read(bstr, { type: 'array', cellDates: true });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: null }) as any[][];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const processed = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const { date, str } = parseExcelDate(row[24]); // Col Y
        const valor = parseMoney(row[23]); // Col X
        processed.push({
          credor: String(row[4] || 'NÃO INFORMADO'),
          destino: String(row[15] || 'NÃO INFORMADO'),
          status: String(row[11] || 'PENDENTE'),
          valor: valor,
          date: date,
          dataStr: str
        });
      }
      
      const filtered = processed
        .filter(r => r.date && r.date >= today)
        .sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
      
      setData(filtered);
      setHasLoaded(true);
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return data.filter(r => 
      r.destino.toLowerCase().includes(term) || 
      r.credor.toLowerCase().includes(term) || 
      r.dataStr.includes(term)
    );
  }, [data, searchTerm]);

  const totalProjetado = filteredData.reduce((sum, r) => sum + r.valor, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-['Plus_Jakarta_Sans']">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="mr-4 text-slate-400 hover:text-emerald-600 transition-colors">
              <i className="fa-solid fa-arrow-left text-xl"></i>
            </button>
            <div className="bg-emerald-600 p-2.5 rounded-2xl shadow-lg shadow-emerald-100">
              <i className="fa-solid fa-file-excel text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-none">Auditor Coluna Y</h1>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Análise de Destinos e Pagamentos</p>
            </div>
          </div>
          <label className="cursor-pointer bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-2xl transition-all text-sm font-bold flex items-center space-x-2 shadow-lg shadow-slate-200">
            <i className="fa-solid fa-upload"></i>
            <span>Carregar Planilha</span>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFile} />
          </label>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10 w-full">
        {!hasLoaded ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
             <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-8">
                <i className="fa-solid fa-location-dot text-4xl text-emerald-500"></i>
             </div>
             <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">Análise de Viagens e Destinos</h2>
             <p className="text-slate-400 text-sm mt-3 text-center max-w-md">
               O sistema exibe a <b>Cidade de Destino</b> como informação principal, filtrando apenas datas futuras da Coluna Y.
             </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
                    <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Destinos Futuros Detectados</span>
                    <div className="text-6xl font-black text-slate-900 leading-none">{filteredData.length}</div>
                    <div className="mt-6 px-4 py-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase rounded-full tracking-widest">
                        Viagens a realizar
                    </div>
                </div>
                <div className="bg-emerald-600 p-10 rounded-[40px] shadow-2xl shadow-emerald-100 flex flex-col justify-center items-center text-center text-white relative overflow-hidden">
                    <span className="text-emerald-100 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Valor Total de Projeção</span>
                    <div className="text-5xl font-black leading-none tabular-nums">{formatCurrency(totalProjetado)}</div>
                    <div className="mt-6 px-4 py-1.5 bg-white/20 text-white text-[10px] font-black uppercase rounded-full tracking-widest">
                        Soma Financeira Futura
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Cidades de Destino</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Ordenados por Data de Pagamento (Coluna Y)</p>
                    </div>
                    <div className="relative group w-full lg:w-96">
                        <i className="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
                        <input 
                            type="text" 
                            placeholder="Buscar cidade, credor ou data..." 
                            className="pl-14 pr-8 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-emerald-50 outline-none w-full transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                                <th className="px-10 py-6">Data de Pagamento (Y)</th>
                                <th className="px-10 py-6">Cidade de Destino</th>
                                <th className="px-10 py-6 text-right">Valor Projetado (X)</th>
                                <th className="px-10 py-6 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredData.length === 0 ? (
                                <tr><td colSpan={4} className="px-10 py-20 text-center text-slate-300 font-black uppercase tracking-widest italic text-sm">Nenhum destino futuro encontrado</td></tr>
                            ) : (
                                filteredData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-all group">
                                        <td className="px-10 py-6 font-black text-slate-900 text-sm">{row.dataStr}</td>
                                        <td className="px-10 py-6">
                                            <div className="text-sm font-black text-slate-900 uppercase group-hover:text-emerald-600 transition-colors">{row.destino}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Credor: {row.credor}</div>
                                        </td>
                                        <td className="px-10 py-6 text-right font-black tabular-nums text-slate-900">{formatCurrency(row.valor)}</td>
                                        <td className="px-10 py-6 text-center">
                                            <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[9px] font-black uppercase text-slate-500 shadow-sm">{row.status}</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL (EXISTENTE + NOVOS BOTÕES) ---
const App: React.FC = () => {
  const [view, setView] = useState<'diarias' | 'finalizados'>('diarias');
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

    const rows = data.slice(1).filter(row => row && row.length > 0);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(new Date().getDate() - 60);

    const filteredDiarias: Diaria[] = [];
    const filteredTimeline: TimelineItem[] = [];
    let valorTotal = 0;
    const credoresSet = new Set<string>();

    rows.forEach(row => {
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
        if (!dataPagamento || dataPagamento.toString().trim() === "" || dataPagamento.toString().trim().toUpperCase() === "N/A") {
          if (totalPagoStr !== undefined && totalPagoStr !== null) {
            const totalPago = parseFloat(totalPagoStr.toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
            if (totalPago === 0 || isNaN(totalPago)) naoPago = true;
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

  if (view === 'finalizados') {
    return <AuditorView onBack={() => setView('diarias')} />;
  }

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
        
        <div className="flex flex-wrap justify-center gap-4">
          <label htmlFor="fileInput" className="inline-flex items-center gap-2 bg-[#FF2800] text-white px-6 py-4 rounded-lg cursor-pointer text-lg font-semibold transition-all hover:-translate-y-1 hover:shadow-[0_5px_15px_rgba(255,40,0,0.3)]">
            <i className="fas fa-file-excel text-xl"></i> Selecionar Arquivo Excel
          </label>
          <input type="file" id="fileInput" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
          
          <button 
            onClick={() => setView('finalizados')}
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-4 rounded-lg cursor-pointer text-lg font-semibold transition-all hover:-translate-y-1 hover:shadow-[0_5px_15px_rgba(5,150,105,0.3)]">
            <i className="fas fa-check-double text-xl"></i> VALORES FINALIZADOS
          </button>
        </div>
        
        <div className="mt-4 text-gray-500 italic font-medium">{fileName}</div>
        
        <div className="mt-5 bg-[#e7f3ff] border border-[#b6d4fe] text-[#084298] p-4 rounded-lg flex items-start gap-3 text-left">
          <i className="fas fa-info-circle text-2xl mt-1"></i>
          <div>
            <strong>Importante:</strong> O sistema analisará automaticamente as diárias dos últimos <strong>60 dias</strong> que constam como não pagas.
          </div>
        </div>
      </section>

      {loading ? (
        <div className="text-center py-10">
          <i className="fas fa-spinner fa-spin text-5xl text-[#FF2800] mb-4"></i>
          <p>Processando planilha...</p>
        </div>
      ) : (
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
                        Nenhuma diária não paga encontrada!
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
            <div className="flex flex-col gap-2">
              {timelineData.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p>Dados indisponíveis para o fluxo.</p>
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
        <p>Sistema de Controle de Diárias - DETRAN/SP | Filtro: 60 Dias</p>
      </footer>
    </div>
  );
};

const StatCard: React.FC<{ icon: string, label: string, value: string | number }> = ({ icon, label, value }) => (
  <div className="bg-white rounded-xl p-6 text-center border-b-4 border-[#FF2800] shadow-sm border border-gray-100">
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
    <div className="bg-white rounded-md border border-gray-100 px-4 py-2 shadow-sm flex flex-col md:flex-row items-center gap-6 hover:border-[#FF2800]/30 transition-all">
      <div className="flex-shrink-0 w-full md:w-56">
        <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-gray-400 bg-gray-50 px-1 py-0.5 rounded">#{item.id}</span>
            <span className="text-[8px] font-bold text-[#FF2800] uppercase tracking-tighter">Pendente</span>
        </div>
        <h4 className="font-black text-gray-800 text-[11px] uppercase mt-0.5 truncate">{item.destino}</h4>
        <p className="text-[9px] text-gray-500 font-medium">{item.datasDeslocamento}</p>
      </div>

      <div className="flex-grow w-full relative h-12 flex items-center">
        <div className="absolute left-6 right-6 h-0.5 bg-gray-100 rounded-full z-0">
           <div className="h-full bg-[#FF2800] rounded-full transition-all duration-700" style={{ width: fillWidth }}></div>
        </div>
        <div className="relative w-full flex justify-between z-10">
          {steps.map((step, idx) => {
            const isDone = !!step.date;
            const isCurrent = (completedSteps === idx);
            return (
              <div key={idx} className="flex flex-col items-center min-w-[70px]">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] border-2 bg-white ${isDone ? 'border-green-500 text-green-500' : isCurrent ? 'border-[#FF2800] text-[#FF2800]' : 'border-gray-200 text-gray-200'}`}>
                  <i className={`fas ${isDone ? 'fa-check' : step.icon}`}></i>
                </div>
                <span className={`text-[7px] font-black uppercase mt-1 ${isDone ? 'text-green-600' : isCurrent ? 'text-[#FF2800]' : 'text-gray-300'}`}>{step.label}</span>
                <span className="text-[7px] text-gray-400 font-mono">{step.date ? formatDate(step.date) : '--/--'}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-shrink-0 text-right min-w-[120px] border-l border-gray-50 pl-6 hidden md:block">
        <div className="text-sm font-black text-gray-900 leading-none mb-1">R$ {item.valor}</div>
        <div className="text-[8px] text-gray-400 italic truncate max-w-[120px]">{item.motivo}</div>
      </div>
    </div>
  );
};

export default App;
