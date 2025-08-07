$(document).ready(function () {
    // --- CONFIGURAÇÃO PRINCIPAL ---
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyGqYEKntIeeXk81hq8uOAFosOqlHHS2Kz9KIy64BWmXG4IQ-53n0wFgZ4gG3VOrY0H/exec";

    let quadroDeFuncionarios = [];
    let dadosDosRelatos = [];

    // --- FUNÇÃO AUXILIAR PARA CORRIGIR DATAS ---
    function formatarData(dataString) {
        if (!dataString) return 'N/A';
        const data = new Date(dataString);
        if (isNaN(data.getTime())) { return 'Data Inválida'; }
        const dia = String(data.getUTCDate()).padStart(2, '0');
        const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
        const ano = data.getUTCFullYear();
        return `${dia}/${mes}/${ano}`;
    }

    async function iniciarDashboard() {
        const pontoDeInjecao = $('#td0id_do_seu_campo_aqui');
        if (pontoDeInjecao.length === 0) return;

        pontoDeInjecao.html(criarEstruturaHTML());
        $('#dashboard-app').hide();
        pontoDeInjecao.append('<h3 id="loading-message" style="font-family: Segoe UI, sans-serif; color: #e2e8f0;">Carregando dashboard, por favor aguarde...</h3>');

        try {
            const response = await fetch(`${SCRIPT_URL}?request_type=dashboard_data`);
            if (!response.ok) throw new Error(`Erro na rede: ${response.statusText}`);
            const data = await response.json();
            if (data.status === 'erro') throw new Error(`Erro no script do Google: ${data.message}`);
            
            quadroDeFuncionarios = data.employees;
            dadosDosRelatos = data.reports;

            $('#loading-message').hide();
            $('#dashboard-app').show();
            
            popularFiltrosIniciais();
            processarEExibirDados('Todos', 'Todos', 'Todos');
            configurarFiltros();

        } catch (error) {
            $('#loading-message').html(`<div style="color: #f56565; background: #4a5568; border: 1px solid #f56565; padding: 15px; border-radius: 8px;"><strong>Falha ao carregar o dashboard.</strong><br><p>Erro: ${error.message}</p></div>`);
        }
    }

    function popularFiltrosIniciais() {
        const setoresUnicos = [...new Set(quadroDeFuncionarios.map(item => item.setor))].filter(Boolean).sort();
        const filtroSetor = $('#filtro-setor');
        filtroSetor.html('<option value="Todos">Todos</option>');
        setoresUnicos.forEach(setor => filtroSetor.append(`<option value="${setor}">${setor}</option>`));

        const mesesUnicos = [...new Set(dadosDosRelatos.map(r => r.dataDaSolicitacao ? r.dataDaSolicitacao.substring(0, 7) : ''))].filter(Boolean).sort().reverse();
        const filtroMesAno = $('#filtro-mes-ano');
        filtroMesAno.html('<option value="Todos">Todos</option>');
        mesesUnicos.forEach(mesAno => {
            const [ano, mes] = mesAno.split('-');
            filtroMesAno.append(`<option value="${mesAno}">${mes}/${ano}</option>`);
        });
    }

    function configurarFiltros() {
        $('#filtro-setor').on('change', function() {
            const setorSelecionado = $(this).val();
            const containerCargo = $('#filtro-cargo-container');
            const filtroCargo = $('#filtro-cargo');

            if (setorSelecionado === 'ENTREGA') {
                if (filtroCargo.children().length <= 1) { // Popula apenas uma vez
                    const cargosEntrega = [...new Set(quadroDeFuncionarios
                        .filter(f => f.setor === 'ENTREGA' && f.cargo)
                        .map(f => f.cargo))]
                        .sort();
                    cargosEntrega.forEach(cargo => filtroCargo.append(`<option value="${cargo}">${cargo}</option>`));
                }
                containerCargo.show();
            } else {
                containerCargo.hide();
                filtroCargo.val('Todos');
            }
            processarEExibirDados(setorSelecionado, $('#filtro-mes-ano').val(), 'Todos');
        });
        
        $('#filtro-mes-ano, #filtro-cargo').on('change', function() {
            processarEExibirDados($('#filtro-setor').val(), $('#filtro-mes-ano').val(), $('#filtro-cargo').val());
        });
    }
    
    function processarEExibirDados(filtroSetor, filtroMesAno, filtroCargo) {
        let funcionariosFiltrados = quadroDeFuncionarios;
        if (filtroSetor !== 'Todos') {
            funcionariosFiltrados = funcionariosFiltrados.filter(f => f.setor === filtroSetor);
        }
        if (filtroSetor === 'ENTREGA' && filtroCargo !== 'Todos') {
            funcionariosFiltrados = funcionariosFiltrados.filter(f => f.cargo === filtroCargo);
        }
        
        const nomesFuncionariosFiltrados = funcionariosFiltrados.map(f => f.nome);
        let relatosFiltrados = dadosDosRelatos.filter(r => nomesFuncionariosFiltrados.includes(r.criador));

        if (filtroMesAno !== 'Todos') {
            relatosFiltrados = relatosFiltrados.filter(r => r.dataDaSolicitacao && r.dataDaSolicitacao.startsWith(filtroMesAno));
        }

        const totalFuncionarios = funcionariosFiltrados.length;
        const totalRelatos = relatosFiltrados.length;
        const funcionariosQueRelataram = new Set(relatosFiltrados.map(r => r.criador));
        const taxaEngajamento = totalFuncionarios > 0 ? ((funcionariosQueRelataram.size / totalFuncionarios) * 100).toFixed(0) : 0;

        $('#total-funcionarios').html(`${totalFuncionarios} <span class="bi-mini">👥</span>`);
        $('#total-relatos').html(`${totalRelatos} <span class="bi-mini">📝</span>`);
        $('#taxa-engajamento').html(`${taxaEngajamento}% <span class="bi-mini">🔥</span>`);

        const atosInseguros = relatosFiltrados.filter(r => r.tipoDoRelato === 'Ato Inseguro' && r.tipoDoAtoInseguro);
        const topAtoInseguro = calcularTop(atosInseguros, 'tipoDoAtoInseguro', 1);
        const comportamentoCritico = topAtoInseguro.length > 0 ? topAtoInseguro[0].item : 'N/A';
        $('#valor-comportamento-critico').text(comportamentoCritico);

        const colunasTop5 = ['tipoDaCondicaoInsegura', 'tipoDoAtoInseguro', 'tipoDoAcidente', 'tipoDoIncidente', 'tipoDoAtoPositivo'];
        colunasTop5.forEach(coluna => {
            const dadosTop = calcularTop(relatosFiltrados, coluna, 5);
            preencherTabelaTop5(`#tabela-top-${coluna}`, dadosTop);
        });
        
        renderizarMetasEVisaoDetalhada(relatosFiltrados, funcionariosFiltrados, filtroMesAno, filtroSetor);
        renderizarGraficosPrincipais(relatosFiltrados, filtroMesAno, funcionariosFiltrados);
    }

    function calcularTop(dados, coluna, limite) {
        if (!dados || dados.length === 0) return [];
        const contagem = dados.reduce((acc, item) => {
            const valor = item[coluna];
            if (valor) {
                acc[valor] = (acc[valor] || 0) + 1;
            }
            return acc;
        }, {});

        return Object.entries(contagem)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limite)
            .map(([item, contagem]) => ({ item, contagem }));
    }

    function preencherTabelaTop5(idTabela, dados) {
        const tbody = $(`${idTabela} tbody`);
        tbody.empty();
        if (dados.length === 0) {
            tbody.html('<tr><td colspan="2" style="text-align:center; font-style:italic; color:#999;">Sem dados.</td></tr>');
            return;
        }
        dados.forEach(d => {
            tbody.append(`<tr><td>${d.item}</td><td style="text-align:center;">${d.contagem}</td></tr>`);
        });
    }
    
    function renderizarMetasEVisaoDetalhada(relatosFiltrados, funcionariosDoSetor, filtroMesAno, filtroSetor) {
        const containerVisaoDetalhada = $('#visao-detalhada-container');
        const containerTabelasPadrao = $('.tables-bis');
        const setoresComMeta = { 'APOIO LOGISTICO': 3, 'ENTREGA': 3, 'PUXADA': 3 };

        if (filtroMesAno === 'Todos' || !setoresComMeta.hasOwnProperty(filtroSetor)) {
            containerVisaoDetalhada.hide();
            containerTabelasPadrao.show();
            preencherTabelas(relatosFiltrados, '#tabela-detalhe-relatos-padrão', '#tabela-ranking-padrão');
            return;
        }
        
        containerVisaoDetalhada.show();
        containerTabelasPadrao.hide();
        
        const metaIndividual = setoresComMeta[filtroSetor];
        
        let contagemTotalCapada = 0;
        let listaFuncionariosHtml = '';
        let rankingData = {};

        funcionariosDoSetor.forEach(func => {
            const relatosFuncionario = relatosFiltrados.filter(r => r.criador === func.nome).length;
            const contribuicao = Math.min(relatosFuncionario, metaIndividual);
            contagemTotalCapada += contribuicao;
            const icone = relatosFuncionario > 0 ? '✔️' : '❌';
            listaFuncionariosHtml += `<li class="detalhe-item"><span>${icone} ${func.nome}</span><span>${relatosFuncionario}</span></li>`;
            if (relatosFuncionario > 0) {
                rankingData[func.nome] = relatosFuncionario;
            }
        });

        const metaTotalSetor = funcionariosDoSetor.length * metaIndividual;
        const porcentagemTotal = metaTotalSetor > 0 ? (contagemTotalCapada / metaTotalSetor) * 100 : 0;

        const cardProgressoHtml = `<div class="table-bi"><h5>Acompanhamento Mensal: ${filtroSetor}</h5><div class="meta-item"><div class="meta-label"><span>Progresso Total da Meta (Engajamento)</span><span>${contagemTotalCapada} / ${metaTotalSetor} Relatos</span></div><div class="meta-progress-bar"><div class="meta-progress" style="width: ${porcentagemTotal}%;"></div></div></div></div>`;
        $('#meta-progresso-container').html(cardProgressoHtml);

        $('#lista-contribuicao-individual').html(listaFuncionariosHtml);

        const rankingHtml = Object.entries(rankingData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([nome, qtde], i) => `<tr><td><b>${i + 1}</b></td><td>${nome}</td><td>${qtde}</td></tr>`)
            .join('');
        $('#tabela-ranking-detalhada').html(rankingHtml);
    }
    
    function preencherTabelas(relatos, seletorDetalhes, seletorRanking) {
        const linhasTabelaDetalhe = relatos.slice(0, 10).map(r => `<tr><td>${formatarData(r.dataDaSolicitacao)}</td><td>${r.criador || ''}</td><td>${r.tipoDoRelato || ''}</td></tr>`).join('');
        $(seletorDetalhes + ' tbody').html(linhasTabelaDetalhe);

        const rankingData = relatos.reduce((acc, r) => {
            if(r.criador) acc[r.criador] = (acc[r.criador] || 0) + 1;
            return acc;
        }, {});
        const linhasTabelaRanking = Object.entries(rankingData).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nome, qtde], i) => `<tr><td><b>${i + 1}</b></td><td>${nome}</td><td>${qtde}</td></tr>`).join('');
        $(seletorRanking + ' tbody').html(linhasTabelaRanking);
    }

    function renderizarGraficosPrincipais(relatosFiltrados, filtroMesAno, funcionariosFiltrados) {
        const mesesBase = [...new Set(dadosDosRelatos.map(r => r.dataDaSolicitacao ? r.dataDaSolicitacao.substring(0, 7) : ''))].filter(Boolean).sort();
        const dadosEvolucaoMensal = mesesBase.map(mes => ({
            mes: mes.split('-')[1] + "/" + mes.split('-')[0].slice(2),
            relatos: dadosDosRelatos.filter(r => r.dataDaSolicitacao && r.dataDaSolicitacao.startsWith(mes)).length
        }));

        const todosSetoresUnicos = [...new Set(quadroDeFuncionarios.map(f => f.setor))].filter(Boolean).sort();
        const relatosPorSetor = todosSetoresUnicos.reduce((acc, setor) => {
            const funcionariosDoSetor = quadroDeFuncionarios.filter(f => f.setor === setor);
            const nomesDoSetor = funcionariosDoSetor.map(f => f.nome);
            let relatosGerais = filtroMesAno === 'Todos' ? dadosDosRelatos : dadosDosRelatos.filter(r => r.dataDaSolicitacao && r.dataDaSolicitacao.startsWith(filtroMesAno));
            acc[setor] = relatosGerais.filter(r => nomesDoSetor.includes(r.criador)).length;
            return acc;
        }, {});
        
        renderizarGraficoLinha(dadosEvolucaoMensal);
        renderizarGraficoColunas(relatosPorSetor, filtroMesAno);
        renderizarGraficoPizza(relatosFiltrados);
    }
    
    function renderizarGraficoLinha(dados) {
        const ctx = document.getElementById('grafico-evolucao-linha').getContext('2d');
        if (window.myLineChart) window.myLineChart.destroy();
        window.myLineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dados.map(d => d.mes),
                datasets: [{
                    label: 'Relatos por Mês',
                    data: dados.map(d => d.relatos),
                    borderColor: '#81e6d9',
                    backgroundColor: 'rgba(129, 230, 217, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { mode: 'index', intersect: false },
                    title: { display: true, text: 'Evolução Mensal de Relatos', font: { size: 16 }, color: '#e2e8f0' }
                },
                scales: {
                    x: { ticks: { color: '#a0aec0' } },
                    y: { ticks: { color: '#a0aec0' }, grid: { color: '#4a5568' } }
                }
            }
        });
    }

    function renderizarGraficoColunas(dados, filtroMesAno) {
        const setoresComMeta = ['PUXADA', 'ENTREGA', 'APOIO LOGISTICO'];
        const metaMensal = 3;
        const corPadrao = '#63b3ed', corMetaBatida = '#68d391', corMetaPendente = '#f6ad55';
        const labels = Object.keys(dados);
        const dataValues = Object.values(dados);
        const coresDasBarras = (filtroMesAno !== 'Todos') ? labels.map(setor => { if (setoresComMeta.includes(setor)) return dados[setor] >= metaMensal ? corMetaBatida : corMetaPendente; return corPadrao; }) : corPadrao;
        const ctx = document.getElementById('grafico-aderencia-colunas').getContext('2d');
        if (window.myColumnChart) window.myColumnChart.destroy();
        window.myColumnChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{ label: 'Total de Relatos', data: dataValues, backgroundColor: coresDasBarras }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { 
                    x: { ticks: { color: '#a0aec0' } },
                    y: { beginAtZero: true, ticks: { stepSize: 1, color: '#a0aec0' }, grid: { color: '#4a5568' } } 
                },
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Total de Relatos por Setor', font: { size: 16 }, color: '#e2e8f0' },
                    tooltip: { callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) label += ': '; if (context.parsed.y !== null) label += context.parsed.y; if (filtroMesAno !== 'Todos' && setoresComMeta.includes(context.label)) { const status = context.raw >= metaMensal ? 'Meta atingida' : `Meta pendente (${context.raw}/${metaMensal})`; return [label, status]; } return label; } } }
                }
            }
        });
    }

    function renderizarGraficoPizza(relatos) {
        const ctx = document.getElementById('grafico-tipo-relato').getContext('2d');
        if (window.myPieChart) window.myPieChart.destroy();
        let tipos = {};
        relatos.forEach(r => { if(r.tipoDoRelato) tipos[r.tipoDoRelato] = (tipos[r.tipoDoRelato] || 0) + 1; });
        window.myPieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(tipos),
                datasets: [{ data: Object.values(tipos), backgroundColor: ["#63b3ed", "#68d391", "#f6ad55", "#fc8181", "#b794f4", "#4fd1c5"] }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#a0aec0' } },
                    title: { display: true, text: 'Distribuição dos Tipos de Relato', font: { size: 16 }, color: '#e2e8f0' }
                }
            }
        });
    }
    
    function criarEstruturaHTML() { return `
        <style>
            .dashboard-container {font-family: 'Segoe UI', sans-serif; background: #2d3748; padding: 24px; border-radius: 18px; box-shadow: 0 4px 24px rgba(0,0,0,0.2);}
            .dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
            .dashboard-header h2 { color: #e2e8f0; margin: 0; }
            .filtros-container { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; flex-wrap: wrap; }
            .filtro-item { display: flex; align-items: center; gap: 8px; }
            .filtro-item label { color: #a0aec0; font-weight: 500; font-size: 14px; }
            .filtro-item select { background-color: #4a5568; color: #e2e8f0; border: 1px solid #718096; border-radius: 8px; padding: 8px 12px; font-size: 16px; }
            .cards-resumo { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 18px; margin-bottom: 28px; }
            .card { background: #fff; border-radius: 10px; padding: 18px; box-shadow: 0 2px 12px #00000014; }
            .card h4 { color: #718096; font-size: 13px; font-weight: 600; margin: 0 0 4px 0; text-transform: uppercase; }
            .card .valor { color: #3182ce; font-size: 26px; font-weight: 700; word-wrap: break-word; min-height: 32px; }
            #visao-detalhada-container { display: none; margin-bottom: 28px; }
            #detalhes-colaboradores-container { display: flex; align-items: stretch; gap: 20px; margin-top: 20px;}
            .detalhe-card { background: #fff; border-radius: 10px; padding: 16px; box-shadow: 0 2px 12px #00000014; flex-basis: 50%; display: flex; flex-direction: column; }
            .detalhe-card h6 { margin-top: 0; font-size: 1rem; color: #4a5568; border-bottom: 1px solid #edf2f7; padding-bottom: 10px; margin-bottom: 8px; flex-shrink: 0; }
            .detalhe-list-wrapper { flex-grow: 1; overflow-y: auto; max-height: 320px; }
            .detalhe-list { list-style-type: none; padding: 0; margin: 0; }
            .detalhe-item { display: flex; justify-content: space-between; padding: 6px 4px; border-bottom: 1px solid #f7fafc; font-size: 14px; }
            .meta-item { margin-bottom: 15px; }
            .meta-label { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 6px; }
            .meta-progress-bar { background-color: #e2e8f0; border-radius: 8px; height: 16px; overflow: hidden; }
            .meta-progress { background-color: #3182ce; height: 100%; border-radius: 8px; }
            .graficos-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px;}
            .grafico { background: #4a5568; border-radius: 10px; padding: 16px; }
            .top-ocorrencias-container { margin-bottom: 28px; }
            .top-ocorrencias-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
            .tables-bis { display: flex; flex-direction: column; gap: 20px; }
            .table-bi { background: #fff; border-radius: 10px; padding: 12px; }
            .table-bi h4 { margin: 5px 5px 10px 5px; color: #3182ce; font-size: 1rem; }
            .table-bi table { border-collapse: collapse; width: 100%; }
            .table-bi th, .table-bi td { font-size: 14px; padding: 6px 8px; text-align: left; }
            .table-bi th { color: #4a5568; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
        </style>
        <div id="dashboard-app" class="dashboard-container">
            <div class="dashboard-header">
                <h2>Relatório de Segurança CDBAR</h2>
            </div>
            <div class="filtros-container">
                <div class="filtro-item">
                    <label for="filtro-setor">Setor:</label>
                    <select id="filtro-setor"><option value="Todos">Todos</option></select>
                </div>
                <div class="filtro-item" id="filtro-cargo-container" style="display: none;">
                    <label for="filtro-cargo">Cargo:</label>
                    <select id="filtro-cargo"><option value="Todos">Todos</option></select>
                </div>
                <div class="filtro-item">
                    <label for="filtro-mes-ano">Mês/Ano:</label>
                    <select id="filtro-mes-ano"><option value="Todos">Todos</option></select>
                </div>
            </div>
            <div class="cards-resumo">
                <div class="card"><h4>Total Funcionários</h4><div id="total-funcionarios" class="valor">0</div></div>
                <div class="card"><h4>Total Relatos</h4><div id="total-relatos" class="valor">0</div></div>
                <div class="card"><h4>Taxa de Engajamento</h4><div id="taxa-engajamento" class="valor">0%</div></div>
                <div class="card"><h4>Comportamento Crítico</h4><div id="valor-comportamento-critico" class="valor" style="font-size: 16px; min-height: 38px; display: flex; align-items: center;">N/A</div></div>
            </div>
            
            <div id="visao-detalhada-container">
                <div id="meta-progresso-container"></div>
                <div id="detalhes-colaboradores-container">
                    <div class="detalhe-card">
                        <h6>Contribuição Individual (Volume)</h6>
                        <div class="detalhe-list-wrapper">
                            <ul id="lista-contribuicao-individual" class="detalhe-list"></ul>
                        </div>
                    </div>
                    <div class="detalhe-card">
                        <h6>Ranking Engajamento (Top 10)</h6>
                        <div class="detalhe-list-wrapper">
                            <table width="100%">
                                <thead><tr><th style="width:10%;">#</th><th>Nome</th><th style="width:20%;">Relatos</th></tr></thead>
                                <tbody id="tabela-ranking-detalhada"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <div class="graficos-container">
                <div class="grafico"><canvas id="grafico-evolucao-linha"></canvas></div>
                <div class="grafico"><canvas id="grafico-aderencia-colunas"></canvas></div>
                <div class="grafico"><canvas id="grafico-tipo-relato"></canvas></div>
            </div>
            
            <div class="top-ocorrencias-container">
                <div class="top-ocorrencias-grid">
                    <div class="table-bi"><h4>Top 5 - Condições Inseguras</h4><table id="tabela-top-tipoDaCondicaoInsegura" width="100%"><thead><tr><th>Ocorrência</th><th style="width:20%;">Qtd</th></tr></thead><tbody></tbody></table></div>
                    <div class="table-bi"><h4>Top 5 - Atos Inseguros</h4><table id="tabela-top-tipoDoAtoInseguro" width="100%"><thead><tr><th>Ocorrência</th><th style="width:20%;">Qtd</th></tr></thead><tbody></tbody></table></div>
                    <div class="table-bi"><h4>Top 5 - Acidentes</h4><table id="tabela-top-tipoDoAcidente" width="100%"><thead><tr><th>Ocorrência</th><th style="width:20%;">Qtd</th></tr></thead><tbody></tbody></table></div>
                    <div class="table-bi"><h4>Top 5 - Incidentes</h4><table id="tabela-top-tipoDoIncidente" width="100%"><thead><tr><th>Ocorrência</th><th style="width:20%;">Qtd</th></tr></thead><tbody></tbody></table></div>
                    <div class="table-bi"><h4>Top 5 - Relatos Positivos</h4><table id="tabela-top-tipoDoAtoPositivo" width="100%"><thead><tr><th>Ocorrência</th><th style="width:20%;">Qtd</th></tr></thead><tbody></tbody></table></div>
                </div>
            </div>

            <div class="tables-bis">
                <div class="table-bi">
                    <h4>Detalhe dos Últimos Relatos</h4>
                    <table id="tabela-detalhe-relatos-padrão" width="100%"><thead><tr><th>Data</th><th>Colaborador</th><th>Tipo</th></tr></thead><tbody></tbody></table>
                </div>
                <div class="table-bi">
                    <h4>Ranking de Engajamento</h4>
                    <table id="tabela-ranking-padrão" width="100%"><thead><tr><th>#</th><th>Nome</th><th>Relatos</th></tr></thead><tbody></tbody></table>
                </div>
            </div>
        </div>
    `;}

    iniciarDashboard();
});
