import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from "firebase/firestore";

document.addEventListener('DOMContentLoaded', () => {
    // ============================================================
    // REFERÊNCIAS DOM
    // ============================================================
    const joinForm = document.getElementById('join-form');
    const joinSection = document.getElementById('join-section');
    const successSection = document.getElementById('success-section');
    const nameInput = document.getElementById('join-name');
    const whatsappInput = document.getElementById('join-whatsapp');
    const lancheInput = document.getElementById('join-lanche');
    const bebidaInput = document.getElementById('join-bebida');
    const submitBtn = document.getElementById('submit-btn');
    const orderSummary = document.getElementById('order-summary');
    const btnNovoPedido = document.getElementById('btn-novo-pedido');

    // ============================================================
    // UTILITÁRIOS
    // ============================================================
    const formatBRL = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    // Pega o preço de uma opção do select
    const getPrice = (selectEl) => {
        if (!selectEl || !selectEl.value) return 0;
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        return parseFloat(selectedOption?.dataset?.price || 0);
    };

    // ============================================================
    // RESUMO DINÂMICO DO PEDIDO
    // ============================================================
    const updateOrderSummary = () => {
        if (!orderSummary) return;

        const lancheValue = lancheInput?.value || '';
        const bebidaValue = bebidaInput?.value || '';
        const lanchePrice = getPrice(lancheInput);
        const bebidaPrice = getPrice(bebidaInput);
        const total = lanchePrice + bebidaPrice;

        // Se nada foi escolhido, esconde o resumo
        if (!lancheValue && !bebidaValue) {
            orderSummary.innerHTML = '';
            return;
        }

        let html = '';

        if (lancheValue) {
            html += `
                <div class="summary-line">
                    <span><i class="fas fa-hamburger" style="color: var(--primary);"></i> ${lancheValue}</span>
                    <span>${formatBRL(lanchePrice)}</span>
                </div>
            `;
        }

        if (bebidaValue) {
            html += `
                <div class="summary-line">
                    <span><i class="fas fa-cocktail" style="color: var(--primary);"></i> ${bebidaValue}</span>
                    <span>${bebidaPrice > 0 ? formatBRL(bebidaPrice) : 'Grátis'}</span>
                </div>
            `;
        }

        if (lancheValue && bebidaValue) {
            html += `
                <div class="summary-total">
                    <span>Total</span>
                    <span>${formatBRL(total)}</span>
                </div>
            `;
        }

        orderSummary.innerHTML = html;
    };

    // Escuta mudanças nos selects
    lancheInput?.addEventListener('change', updateOrderSummary);
    bebidaInput?.addEventListener('change', updateOrderSummary);

    // ============================================================
    // BOTÃO "FAZER OUTRO PEDIDO"
    // ============================================================
    btnNovoPedido?.addEventListener('click', () => {
        sessionStorage.removeItem('queueUserId');
        successSection.classList.add('hidden');
        joinSection.classList.remove('hidden');
        joinForm.reset();
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Entrar na Fila';
        if (orderSummary) orderSummary.innerHTML = '';
    });

    // ============================================================
    // ESCUTA EM TEMPO REAL DA POSIÇÃO NA FILA
    // ============================================================
    const listenToQueuePosition = (userId) => {
        const q = query(collection(db, "queue"), orderBy("timestamp", "asc"));

        onSnapshot(q, (snapshot) => {
            const queue = snapshot.docs;
            const userIndex = queue.findIndex(doc => doc.id === userId);
            const position = userIndex + 1;

            const positionNumberEl = document.getElementById('position-number');
            const peopleAheadEl = document.getElementById('people-ahead');
            const turnAlertEl = document.getElementById('turn-alert');
            const timeEstimateEl = document.getElementById('time-estimate-value');

            if (position > 0) {
                if (positionNumberEl) positionNumberEl.textContent = `${position}º`;
                const peopleAhead = userIndex;
                if (peopleAheadEl) {
                    peopleAheadEl.textContent = peopleAhead > 0
                        ? `${peopleAhead} pessoa(s) na sua frente`
                        : "Você é o próximo!";
                }
                
                // Tempo estimado: ~4 min por pessoa à frente (mínimo 3 min)
                if (timeEstimateEl) {
                    const estimatedMinutes = Math.max(3, peopleAhead * 4);
                    timeEstimateEl.textContent = `~${estimatedMinutes} min`;
                }
                
                if (position <= 3) {
                    turnAlertEl?.classList.remove('hidden');
                } else {
                    turnAlertEl?.classList.add('hidden');
                }
            } else {
                if (positionNumberEl) positionNumberEl.textContent = '✓';
                if (peopleAheadEl) peopleAheadEl.textContent = "Seu pedido já foi chamado ou entregue.";
                if (timeEstimateEl) timeEstimateEl.textContent = 'Agora!';
                turnAlertEl?.classList.add('hidden');
            }
        });
    };

    // ============================================================
    // SUBMISSÃO DO FORMULÁRIO
    // ============================================================
    joinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando Pedido...';
        
        const name = nameInput.value.trim();
        const whatsapp = whatsappInput.value.trim();
        const lanche = lancheInput.value;
        const bebida = bebidaInput.value;
        const lanchePrice = getPrice(lancheInput);
        const bebidaPrice = getPrice(bebidaInput);
        const total = lanchePrice + bebidaPrice;

        console.log("Iniciando envio para o Firebase...", { name, whatsapp, lanche, bebida, total });

        try {
            const docRef = await addDoc(collection(db, "queue"), {
                name: name,
                whatsapp: whatsapp,
                lanche: lanche,
                bebida: bebida,
                lanchePrice: lanchePrice,
                bebidaPrice: bebidaPrice,
                total: total,
                paymentStatus: 'pending', // prepara para PIX/cartão na Fase 4
                timestamp: serverTimestamp()
            });

            console.log("Pedido enviado com sucesso! ID:", docRef.id);

            sessionStorage.setItem('queueUserId', docRef.id);

            // Preenche a tela de sucesso
            const confirmName = document.getElementById('confirm-name');
            const confirmPedido = document.getElementById('confirm-pedido');
            const confirmTotal = document.getElementById('confirm-total');
            
            if (confirmName) confirmName.textContent = name;
            if (confirmPedido) confirmPedido.textContent = `${lanche} + ${bebida}`;
            if (confirmTotal) confirmTotal.textContent = formatBRL(total);
            
            joinSection.classList.add('hidden');
            successSection.classList.remove('hidden');

            listenToQueuePosition(docRef.id);

        } catch (error) {
            console.error("Erro detalhado ao enviar para o Firebase: ", error);
            alert("Não foi possível enviar o pedido. Verifique sua conexão.");
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Entrar na Fila';
        }
    });

    // ============================================================
    // RECUPERA SESSÃO ANTERIOR
    // ============================================================
    const existingUserId = sessionStorage.getItem('queueUserId');
    if (existingUserId) {
        joinSection.classList.add('hidden');
        successSection.classList.remove('hidden');
        listenToQueuePosition(existingUserId);
    }
});
