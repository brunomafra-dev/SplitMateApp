"use client";

import { ArrowLeft, Plus, Check, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Participant {
  id: string;
  name: string;
  email?: string;
}

interface TransactionRow {
  id: string;
  group_id: string;
  value: number;
  description: string;
  payer_id: string;
  participants: string[]; // array of participant ids
  splits: Record<string, number>;
  created_at?: string;
}

interface GroupRow {
  id: string;
  name: string;
  participants?: Participant[];
  participantsList?: Participant[];
}

export default function EditExpensePage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const expenseId = params.expenseId as string;

  const [loading, setLoading] = useState(true);

  const [group, setGroup] = useState<GroupRow | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [value, setValue] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [payerId, setPayerId] = useState<string>("");
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");

  const [weights, setWeights] = useState<Record<string, number>>({});
  const [calculatedSplits, setCalculatedSplits] = useState<Record<string, number>>({});
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  // load group and transaction
  useEffect(() => {
    if (!groupId || !expenseId) return;

    async function load() {
      setLoading(true);

      // load group (to get participants)
      const { data: g, error: gerr } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single();

      if (gerr) {
        console.error("Erro ao buscar grupo:", gerr);
      } else {
        setGroup(g);
        const list: Participant[] = (g.participants ?? g.participantsList) || [];
        setParticipants(list);

        // init weights default
        const defaultWeights: Record<string, number> = {};
        list.forEach((p: Participant) => (defaultWeights[p.id] = 1));
        setWeights(defaultWeights);
      }

      // load transaction
      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", expenseId)
        .single();

      if (txErr) {
        console.error("Erro ao buscar transação:", txErr);
        setLoading(false);
        return;
      }

      if (tx) {
        // populate form from tx
        setValue(String(tx.value ?? ""));
        setDescription(tx.description ?? "");
        setPayerId(tx.payer_id ?? "");
        const participantsFromTx: string[] = tx.participants ?? [];
        setSelectedParticipants(participantsFromTx);

        // if tx.splits exists, try to infer weights (normalize to 1..n)
        if (tx.splits) {
          // convert splits to rough weights (value proportional)
          const weightsObj: Record<string, number> = {};
          Object.entries(tx.splits).forEach(([pid, v]) => {
            // avoid zero
            weightsObj[pid] = Number(parseFloat(String(v))) || 1;
          });
          // if group participants exist, ensure all have at least 1
          ( (g?.participants ?? g?.participantsList) || []).forEach((p: Participant) => {
            if (!weightsObj[p.id]) weightsObj[p.id] = 1;
          });
          setWeights(weightsObj);
          setCalculatedSplits(tx.splits ?? {});
          // if splits equal for all -> equal mode
          const values = Object.values(tx.splits || {});
          const allEqual = values.every(v => Math.abs(Number(v) - Number(values[0] ?? 0)) < 0.005);
          setSplitType(allEqual ? "equal" : "custom");
        } else {
          setSplitType("equal");
        }
      }

      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, expenseId]);

  function toggleParticipant(pid: string) {
    if (selectedParticipants.includes(pid)) {
      setSelectedParticipants(prev => prev.filter(p => p !== pid));
    } else {
      setSelectedParticipants(prev => [...prev, pid]);
    }
  }

  function calculateCustomSplits() {
    const total = parseFloat(value);
    if (!total || total <= 0) {
      setCalculatedSplits({});
      return {};
    }

    // sum weights only for selected participants
    const totalWeight = selectedParticipants.reduce((acc, pid) => acc + (weights[pid] || 1), 0);
    if (totalWeight === 0) return {};

    const result: Record<string, number> = {};
    selectedParticipants.forEach(pid => {
      const w = weights[pid] ?? 1;
      result[pid] = parseFloat(((total * w) / totalWeight).toFixed(2));
    });

    setCalculatedSplits(result);
    return result;
  }

  function calculateEqualSplits() {
    const total = parseFloat(value);
    if (!total || total <= 0) {
      setCalculatedSplits({});
      return {};
    }
    const count = selectedParticipants.length || participants.length;
    const per = parseFloat((total / Math.max(1, count)).toFixed(2));
    const result: Record<string, number> = {};
    const list = selectedParticipants.length ? selectedParticipants : participants.map(p => p.id);
    list.forEach(pid => (result[pid] = per));
    setCalculatedSplits(result);
    return result;
  }

  async function handleUpdate() {
    if (!value || !description || !payerId) {
      alert("Preencha valor, descrição e selecione quem pagou");
      return;
    }
    // ensure selected participants includes at least the payer
    if (!selectedParticipants.includes(payerId)) {
      setSelectedParticipants(prev => [...prev, payerId]);
    }

    let splitsToSave: Record<string, number> = {};
    if (splitType === "equal") splitsToSave = calculateEqualSplits();
    else splitsToSave = calculateCustomSplits();

    // fallback: if splits empty, calculate equal
    if (!splitsToSave || Object.keys(splitsToSave).length === 0) {
      splitsToSave = calculateEqualSplits();
    }

    const updateObj = {
      value: parseFloat(value),
      description,
      payer_id: payerId,
      participants: selectedParticipants,
      splits: splitsToSave,
      // not touching created_at
    };

    const { error } = await supabase
      .from("transactions")
      .update(updateObj)
      .eq("id", expenseId);

    if (error) {
      console.error("Erro ao atualizar gasto:", error);
      alert("Erro ao atualizar. Veja console.");
      return;
    }

    // success
    router.push(`/group/${groupId}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F7]">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/group/${groupId}`}>
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </Link>

          <h1 className="text-lg font-semibold text-gray-800">Editar gasto</h1>

          <div className="flex gap-2">
            <button
              onClick={() => router.back()}
              className="px-3 py-1 rounded-lg border"
              title="Cancelar"
            >
              <X className="w-4 h-4" />
            </button>

            <button
              onClick={handleUpdate}
              className="px-3 py-1 rounded-lg bg-[#5BC5A7] text-white flex items-center gap-2"
            >
              <Check className="w-4 h-4" /> Atualizar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Valor */}
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <label className="text-gray-600 font-medium">Valor</label>
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="text-3xl w-full text-center border-b mt-2"
            placeholder="0,00"
          />
        </div>

        {/* Descrição */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <label className="block font-medium text-gray-600">Descrição</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Churrasco, Mercado..."
            className="w-full px-4 py-2 border mt-2 rounded-lg"
          />
        </div>

        {/* Quem pagou */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <label className="font-medium text-gray-600">Quem pagou?</label>

          {participants.map(p => (
            <button
              key={p.id}
              onClick={() => setPayerId(p.id)}
              className={`w-full text-left p-3 border rounded-lg mt-2 ${
                payerId === p.id ? "border-[#5BC5A7] bg-green-50" : ""
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Selecionar participantes */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <label className="font-medium text-gray-600">Quem participou?</label>
          <div className="mt-2 space-y-2">
            {participants.map(p => {
              const isSelected = selectedParticipants.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleParticipant(p.id)}
                  className={`w-full p-3 rounded-lg border flex justify-between items-center ${
                    isSelected ? "border-[#5BC5A7] bg-green-50" : "border-gray-200"
                  }`}
                >
                  <span>{p.name}</span>
                  <span className="text-sm text-gray-600">{isSelected ? "participa" : "não"}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tipo de divisão */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <label className="font-medium text-gray-600">Como dividir?</label>

          <div className="flex gap-3 mt-3">
            <button
              onClick={() => setSplitType("equal")}
              className={`flex-1 p-2 rounded-lg ${
                splitType === "equal" ? "bg-[#5BC5A7] text-white" : "bg-gray-200"
              }`}
            >
              Igual
            </button>

            <button
              onClick={() => setSplitType("custom")}
              className={`flex-1 p-2 rounded-lg ${
                splitType === "custom" ? "bg-[#5BC5A7] text-white" : "bg-gray-200"
              }`}
            >
              Personalizada
            </button>
          </div>

          {splitType === "custom" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-gray-600">Defina o peso de cada pessoa (0 = não participa):</p>

              {participants.map(p => (
                <div key={p.id} className="flex justify-between items-center border p-2 rounded-lg">
                  <span>{p.name}</span>
                  <input
                    type="number"
                    min={0}
                    value={weights[p.id] ?? 0}
                    onChange={(e) => setWeights({ ...weights, [p.id]: Number(e.target.value) })}
                    className="w-20 border rounded p-1 text-center"
                  />
                </div>
              ))}

              <div className="flex gap-2 mt-2">
                <button onClick={calculateCustomSplits} className="bg-[#5BC5A7] text-white px-4 py-2 rounded-lg">
                  Calcular divisão
                </button>
                <button onClick={() => setCalculatedSplits({})} className="px-4 py-2 rounded-lg border">
                  Limpar
                </button>
              </div>

              {Object.keys(calculatedSplits).length > 0 && (
                <div className="mt-3 p-3 bg-gray-100 rounded-lg">
                  {Object.entries(calculatedSplits).map(([pid, v]) => {
                    const name = participants.find(x => x.id === pid)?.name ?? pid;
                    return <p key={pid}><strong>{name}:</strong> R$ {v.toFixed(2)}</p>;
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

