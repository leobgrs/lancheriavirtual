import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from "firebase/firestore";

document.addEventListener('DOMContentLoaded', () => {
    const joinForm = document.getElementById('join-form');
    const joinSection = document.getElementById('join-section');
    const successSection = document.getElementById('success-section');
    const nameInput = document.getElementById('join-name');
    const whatsappInput = document.getElementById('join-whatsapp');
    const lancheInput = document.getElementById('join-lanche');
    const bebidaInput = document.getElementById('join-bebida');
    const submitBtn = document.getElementById('submit-btn');

    // Criar dinamicamente um botão de "Novo Pedido" caso não exista no HTML
    let btnNovoPedido = document.getElementById('btn-novo-pedido');
    if (!btnNovoPedido && successSection) {
        btnNovoPedido = document.createElement('button');
        btnNovoPedido.id = 'btn-novo-pedido';
        btnNovoPedido.className = 'btn btn-secondary';
        btnNovoPedido.innerHTML = '<i class="fas fa-redo"></i> Fazer Novo Pedido';
        btnNovoPedido.style.cssText = 'margin-top: 20px; background-color: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; width: 100%;';
        successSection.appendChild(btnNovoPedido);
    }

    btnNovoPedido?.addEventListener('click', () => {
        sessionStorage.removeItem('queueUserId');
        successSection.classList.add('hidden');
        joinSection.classList.remove('hidden');
        joinForm.reset();
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Enviar Pedido';
    });

    const listenToQueuePosition = (userId) => {
        const q = query(collection(db, "queue"), orderBy("timestamp", "asc"));

        onSnapshot(q, (snapshot) => {
            const queue = snapshot.docs;
            const userIndex = queue.findIndex(doc => doc.id === userId);
            const position = userIndex + 1;

            const positionNumberEl = document.getElementById('position-number');
            const peopleAheadEl = document.getElementById('people-ahead');
            const turnAlertEl = document.getElementById('turn-alert');

            if (position > 0) {
                if (positionNumberEl) positionNumberEl.textContent = position;
                const peopleAhead = userIndex;
                if (peopleAheadEl) {
                    peopleAheadEl.textContent = peopleAhead > 0 ? `${peopleAhead} pessoa(s) na sua frente.` : "Você é o próximo!";
                }
                
                if (position <= 3) {
                    turnAlertEl?.classList.remove('hidden');
                } else {
                    turnAlertEl?.classList.add('hidden');
                }
            } else {
                if (positionNumberEl) positionNumberEl.textContent = '✓';
                if (peopleAheadEl) peopleAheadEl.textContent = "Seu pedido já foi chamado ou entregue.";
                turnAlertEl?.classList.add('hidden');
            }
        });
    };

    joinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando Pedido...';
        
        const name = nameInput.value.trim();
        const whatsapp = whatsappInput.value.trim();
        const lanche = lancheInput.value;
        const bebida = bebidaInput.value;

        console.log("Iniciando envio para o Firebase...", { name, whatsapp, lanche, bebida });

        try {
            const docRef = await addDoc(collection(db, "queue"), {
                name: name,
                whatsapp: whatsapp,
                lanche: lanche,
                bebida: bebida,
                timestamp: serverTimestamp()
            });

            console.log("Pedido enviado com sucesso! ID:", docRef.id);

            sessionStorage.setItem('queueUserId', docRef.id);

            const confirmName = document.getElementById('confirm-name');
            const confirmPedido = document.getElementById('confirm-pedido');
            if (confirmName) confirmName.textContent = name;
            if (confirmPedido) confirmPedido.textContent = `${lanche} + ${bebida}`;
            
            joinSection.classList.add('hidden');
            successSection.classList.remove('hidden');

            listenToQueuePosition(docRef.id);

        } catch (error) {
            console.error("Erro detalhado ao enviar para o Firebase: ", error);
            alert("Não foi possível enviar o pedido. Verifique sua conexão.");
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Enviar Pedido';
        }
    });

    const existingUserId = sessionStorage.getItem('queueUserId');
    if(existingUserId) {
        joinSection.classList.add('hidden');
        successSection.classList.remove('hidden');
        listenToQueuePosition(existingUserId);
    }
});