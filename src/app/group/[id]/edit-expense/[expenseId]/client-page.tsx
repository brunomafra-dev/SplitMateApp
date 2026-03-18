"use client";

import { ArrowLeft, Check, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/ui/bottom-nav";
import UserAvatar from "@/components/user-avatar";
import { sanitizeMoney } from "@/lib/money";
import {
  buildEqualSplits,
  buildWeightedSplits,
  normalizePersistedSplits,
} from "@/lib/transaction-splits";
import { computePendingEdges } from "@/lib/pending-balances";

interface Participant {
  id: string;
  name: string;
  avatarKey?: string;
  isPremium?: boolean;
}

interface TransactionRow {
  id: string;
  value: number;
  description: string;
  payer_id: string;
  participants?: string[];
  splits?: Record<string, number>;
  status?: string;
}

export default function EditExpensePage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const expenseId = params.expenseId as string;

  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [groupName, setGroupName] = useState("Editar gasto");

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [payerId, setPayerId] = useState("");
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [calculatedSplits, setCalculatedSplits] = useState<Record<string, number>>({});
  const [persistedSplits, setPersistedSplits] = useState<Record<string, number>>({});
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const [originalPayerId, setOriginalPayerId] = useState("");
  const [paidBySettlement, setPaidBySettlement] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isCreator = Boolean(currentUserId && originalPayerId && currentUserId === originalPayerId);
  const isPaid = paidBySettlement;
  const canEdit = isCreator && !isPaid;
  const canDelete = isCreator && isPaid;

  useEffect(() => {
    if (!groupId || !expenseId) return;

    const load = async () => {
      setLoading(true);
      setPaidBySettlement(false);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const uid = session.user.id;
      setCurrentUserId(uid);

      const { data: groupRow, error: groupError } = await supabase
        .from("groups")
        .select("id,name")
        .eq("id", groupId)
        .single();

      if (groupError || !groupRow) {
        console.error("edit-expense.group-load-error", groupError);
        router.replace("/");
        return;
      }

      setGroupName(String(groupRow.name || "Editar gasto"));

      const participantSelectCandidates = [
        "id,user_id,display_name",
        "id,user_id",
        "user_id",
      ];
      let participantRows: Array<{ id?: string | null; user_id?: string | null; display_name?: string | null }> | null = null;
      let participantError: any = null;

      for (const selectClause of participantSelectCandidates) {
        const attempt = await supabase
          .from("participants")
          .select(selectClause)
          .eq("group_id", groupId);

        if (!attempt.error) {
          participantRows = ((attempt.data as Array<{ id?: string | null; user_id?: string | null; display_name?: string | null }> | null) ?? []);
          participantError = null;
          break;
        }

        participantError = attempt.error;
      }

      if (participantError) {
        console.error("edit-expense.participants-load-error", participantError);
        setLoading(false);
        return;
      }

      const participantRowsSafe = (participantRows ?? []);
      const legacyParticipantToUserId = new Map<string, string>();
      for (const row of participantRowsSafe) {
        const legacyId = String(row.id || "").trim();
        const userId = String(row.user_id || "").trim();
        if (legacyId && userId) legacyParticipantToUserId.set(legacyId, userId);
      }

      const userIds = participantRowsSafe
        .map((row) => String(row.user_id || "").trim())
        .filter(Boolean);

      let profileMap = new Map<string, { username?: string; full_name?: string; avatar_key?: string; is_premium?: boolean }>();
      if (userIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from("profiles")
          .select("id,username,full_name,avatar_key,is_premium")
          .in("id", userIds);

        if (profilesError) {
          console.error("edit-expense.profiles-load-error", profilesError);
        } else {
          for (const row of profileRows ?? []) {
            const id = String((row as { id?: string }).id || "").trim();
            if (!id) continue;
            profileMap.set(id, {
              username: String((row as { username?: string }).username || "").trim(),
              full_name: String((row as { full_name?: string }).full_name || "").trim(),
              avatar_key: String((row as { avatar_key?: string }).avatar_key || "").trim(),
              is_premium: Boolean((row as { is_premium?: boolean }).is_premium),
            });
          }
        }
      }

      const normalizedParticipants: Participant[] = participantRowsSafe.map((row) => {
        const userId = String(row.user_id || "").trim();
        const participantId = String(row.id || userId).trim();
        if (userId) {
          const profile = profileMap.get(userId);
          const name = profile?.username || profile?.full_name || "Participante";
          return {
            id: userId,
            name,
            avatarKey: profile?.avatar_key || "",
            isPremium: Boolean(profile?.is_premium),
          };
        }

        return {
          id: participantId,
          name: String(row.display_name || "Participante").trim() || "Participante",
          avatarKey: "",
          isPremium: false,
        };
      });

      const participantMap = new Map<string, Participant>();
      for (const participant of normalizedParticipants) {
        participantMap.set(participant.id, participant);
      }

      const txSelectCandidates = [
        "id,value,description,payer_id,participants,splits,status",
        "id,value,description,payer_id,splits,status",
        "id,value,description,payer_id,participants,status",
        "id,value,description,payer_id,status",
        "id,value,description,payer_id,participants,splits",
        "id,value,description,payer_id,splits",
        "id,value,description,payer_id,participants",
        "id,value,description,payer_id",
      ];

      let tx: TransactionRow | null = null;
      let txError: any = null;

      for (const selectClause of txSelectCandidates) {
        const attempt = await supabase
          .from("transactions")
          .select(selectClause)
          .eq("id", expenseId)
          .single();

        if (!attempt.error && attempt.data) {
          tx = attempt.data as unknown as TransactionRow;
          txError = null;
          break;
        }

        txError = attempt.error;
      }

      if (txError || !tx) {
        console.error("edit-expense.transaction-load-error", {
          code: txError?.code,
          message: txError?.message,
          details: txError?.details,
          hint: txError?.hint,
          expenseId,
          groupId,
        });
        setFeedback({ type: "error", text: "Erro ao carregar gasto para edição." });
        setLoading(false);
        return;
      }

      const transaction = tx as TransactionRow;
      const normalizedPayerId = legacyParticipantToUserId.get(String(transaction.payer_id || "").trim()) || String(transaction.payer_id || "").trim();
      const normalizedSplits = normalizePersistedSplits(Number(transaction.value) || 0, transaction.splits);
      setPersistedSplits(normalizedSplits);
      const splitParticipantIds = Object.keys(normalizedSplits);

      for (const splitParticipantId of splitParticipantIds) {
        if (!participantMap.has(splitParticipantId)) {
          participantMap.set(splitParticipantId, {
            id: splitParticipantId,
            name: "Participante",
          });
        }
      }
      if (normalizedPayerId && !participantMap.has(normalizedPayerId)) {
        participantMap.set(normalizedPayerId, {
          id: normalizedPayerId,
          name: "Participante",
        });
      }

      const participantsForEdition = Array.from(participantMap.values());
      setParticipants(participantsForEdition);

      const defaultWeights: Record<string, number> = {};
      for (const participant of participantsForEdition) {
        defaultWeights[participant.id] = 1;
      }
      setWeights(defaultWeights);
      setValue(String(Number(transaction.value) || ""));
      setDescription(String(transaction.description || ""));
      setPayerId(normalizedPayerId);
      setOriginalPayerId(normalizedPayerId);

      const participantIdsFromTx = splitParticipantIds.length > 0
        ? splitParticipantIds
        : Array.isArray(transaction.participants)
          ? transaction.participants
              .map((id) => {
                const raw = String(id || "").trim();
                if (!raw) return "";
                return legacyParticipantToUserId.get(raw) || raw;
              })
              .filter(Boolean)
          : participantsForEdition.map((p) => p.id);
      const validParticipantIdsFromTx = participantIdsFromTx.filter((id) => participantsForEdition.some((p) => p.id === id));
      const resolvedParticipants = validParticipantIdsFromTx.length > 0 ? validParticipantIdsFromTx : participantsForEdition.map((p) => p.id);
      setSelectedParticipants(resolvedParticipants);

      const { data: paymentRows } = await supabase
        .from("payments")
        .select("from_user,to_user,amount,created_at")
        .eq("group_id", groupId);

      const groupTransactionsSelectCandidates = [
        "id,group_id,value,payer_id,description,status,created_at,splits,participants",
        "id,group_id,value,payer_id,description,status,created_at,splits",
        "id,group_id,value,payer_id,description,created_at,splits,participants",
        "id,group_id,value,payer_id,description,created_at,splits",
        "id,group_id,value,payer_id,description,created_at",
      ];

      let groupTransactionsRows: Array<{
        id?: string;
        group_id?: string;
        value?: number;
        payer_id?: string;
        description?: string;
        status?: string;
        created_at?: string;
        participants?: string[];
        splits?: Record<string, number>;
      }> | null = null;
      let groupTransactionsError: any = null;

      for (const selectClause of groupTransactionsSelectCandidates) {
        const attempt = await supabase
          .from("transactions")
          .select(selectClause)
          .eq("group_id", groupId);

        if (!attempt.error) {
          groupTransactionsRows = (attempt.data as typeof groupTransactionsRows) ?? [];
          groupTransactionsError = null;
          break;
        }
        groupTransactionsError = attempt.error;
      }

      if (groupTransactionsError) {
        console.error("edit-expense.group-transactions-load-error", {
          code: groupTransactionsError?.code,
          message: groupTransactionsError?.message,
          details: groupTransactionsError?.details,
          hint: groupTransactionsError?.hint,
          groupId,
          expenseId,
        });
      }

      const safeGroupTransactions = ((groupTransactionsRows as typeof groupTransactionsRows) ?? []).map((row) => ({
        id: String(row.id || ""),
        group_id: String(row.group_id || groupId),
        value: Number(row.value) || 0,
        payer_id: String(row.payer_id || ""),
        description: String(row.description || ""),
        // Ignore persisted status here: settlement check must be derived from splits/payments only.
        status: "",
        created_at: row.created_at || undefined,
        participants: Array.isArray(row.participants) ? row.participants : undefined,
        splits: (row.splits && typeof row.splits === "object") ? row.splits : undefined,
      }));

      const safePayments = ((paymentRows as Array<{ from_user?: string; to_user?: string; amount?: number; created_at?: string }> | null) ?? []).map((row) => ({
        group_id: groupId,
        from_user: String(row.from_user || ""),
        to_user: String(row.to_user || ""),
        amount: Number(row.amount) || 0,
        created_at: row.created_at || undefined,
      }));

      let settled = false;
      if (safeGroupTransactions.some((txRow) => txRow.id === expenseId)) {
        const pendingEdges = computePendingEdges(safeGroupTransactions, safePayments);
        const hasPendingForThisExpense = pendingEdges.some((edge) => edge.txId === expenseId && Number(edge.amount) > 0);
        settled = !hasPendingForThisExpense;
      } else {
        console.error("edit-expense.settlement-check-skip", { groupId, expenseId });
      }

      setPaidBySettlement(settled);
      if (settled) {
        setFeedback({ type: "error", text: "Este gasto já foi pago e não pode ser editado." });
      }

      if (Object.keys(normalizedSplits).length > 0) {
        setCalculatedSplits(normalizedSplits);
        const weightMap: Record<string, number> = { ...defaultWeights };
        for (const [key, splitValue] of Object.entries(normalizedSplits)) {
          weightMap[key] = Number(splitValue) > 0 ? Number(splitValue) : 1;
        }
        setWeights(weightMap);

        const values = Object.values(normalizedSplits);
        const first = Number(values[0] || 0);
        const allEqual = values.every((v) => Math.abs(Number(v) - first) < 0.005);
        setSplitType(allEqual ? "equal" : "custom");
      }

      setLoading(false);
    };

    load();
  }, [expenseId, groupId, router]);

  const toggleParticipant = (participantId: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(participantId) ? prev.filter((id) => id !== participantId) : [...prev, participantId]
    );
  };

  const splitPreviewByParticipant = useMemo(() => {
    const total = Number.parseFloat(value);
    if (!Number.isFinite(total) || total <= 0) {
      if (Object.keys(calculatedSplits).length > 0) return calculatedSplits;
      if (Object.keys(persistedSplits).length > 0) return persistedSplits;
      return {} as Record<string, number>;
    }

    const selected = selectedParticipants.length > 0
      ? selectedParticipants
      : participants.map((p) => p.id);
    if (selected.length === 0) return {} as Record<string, number>;

    if (splitType === "custom") {
      const manualWeights: Record<string, number> = { ...weights };
      if ((manualWeights[payerId] ?? 0) <= 0) {
        manualWeights[payerId] = 1;
      }
      const weightedParticipants = selected.filter((id) => Number(manualWeights[id] || 0) > 0);
      if (!weightedParticipants.includes(payerId)) {
        weightedParticipants.push(payerId);
      }
      return buildWeightedSplits(sanitizeMoney(total), weightedParticipants, manualWeights);
    }

    if (splitType === "equal") {
      return buildEqualSplits(sanitizeMoney(total), selected);
    }

    return {} as Record<string, number>;
  }, [calculatedSplits, participants, payerId, persistedSplits, selectedParticipants, splitType, value, weights]);

  const calculateEqualSplits = () => {
    const total = Number.parseFloat(value);
    if (!total || total <= 0) {
      setCalculatedSplits({});
      return {} as Record<string, number>;
    }

    const list = selectedParticipants.length > 0 ? selectedParticipants : participants.map((p) => p.id);
    const next = buildEqualSplits(sanitizeMoney(total), list);

    setCalculatedSplits(next);
    return next;
  };

  const calculateCustomSplits = () => {
    const total = Number.parseFloat(value);
    if (!total || total <= 0) {
      setCalculatedSplits({});
      return {} as Record<string, number>;
    }

    const baseList = selectedParticipants.length > 0 ? selectedParticipants : participants.map((p) => p.id);
    const manualWeights: Record<string, number> = { ...weights };
    if ((manualWeights[payerId] ?? 0) <= 0) {
      manualWeights[payerId] = 1;
    }
    const list = baseList.filter((id) => Number(manualWeights[id] || 0) > 0);
    if (!list.includes(payerId)) {
      list.push(payerId);
    }

    const next = buildWeightedSplits(sanitizeMoney(total), list, manualWeights);
    if (Object.keys(next).length === 0) {
      setCalculatedSplits({});
      return {} as Record<string, number>;
    }

    setCalculatedSplits(next);
    return next;
  };

  const handleUpdate = async () => {
    if (isPaid) {
      setFeedback({ type: "error", text: "Este gasto já foi pago e não pode ser editado." });
      return;
    }

    if (!isCreator) {
      setFeedback({ type: "error", text: "Somente quem criou o gasto pode editar." });
      return;
    }

    if (!description.trim() || !value || Number(value) <= 0 || !payerId) {
      setFeedback({ type: "error", text: "Preencha valor, descrição e pagador." });
      return;
    }
    setFeedback(null);

    const selected = Array.from(
      new Set((selectedParticipants.length > 0 ? selectedParticipants : participants.map((p) => p.id)).map((id) => String(id || "").trim()).filter(Boolean))
    );
    if (!selected.includes(payerId)) {
      selected.push(payerId);
    }

    const splitsToSave = splitType === "equal" ? calculateEqualSplits() : calculateCustomSplits();
    if (Object.keys(splitsToSave).length === 0) {
      setFeedback({
        type: "error",
        text: splitType === "custom"
          ? "Divisão manual inválida. Ajuste os pesos dos participantes."
          : "Divisão inválida para este gasto.",
      });
      return;
    }

    const normalizedValue = sanitizeMoney(Number(value));

    const baseUpdatePayload = {
      value: normalizedValue,
      description: description.trim(),
      payer_id: payerId,
      splits: splitsToSave,
    };

    let updateAttempt = await supabase
      .from("transactions")
      .update({
        ...baseUpdatePayload,
        participants: selected,
      })
      .eq("id", expenseId)
      .eq("payer_id", currentUserId);

    if (
      updateAttempt.error?.code === "PGRST204" &&
      String(updateAttempt.error?.message || "").includes("'participants'")
    ) {
      updateAttempt = await supabase
        .from("transactions")
        .update(baseUpdatePayload)
        .eq("id", expenseId)
        .eq("payer_id", currentUserId);
    }

    if (updateAttempt.error) {
      console.error("edit-expense.update-error", {
        code: updateAttempt.error.code,
        message: updateAttempt.error.message,
        details: updateAttempt.error.details,
        hint: updateAttempt.error.hint,
      });
      setFeedback({ type: "error", text: "Erro ao atualizar gasto." });
      return;
    }

    const check = await supabase
      .from("transactions")
      .select("id")
      .eq("id", expenseId)
      .eq("payer_id", currentUserId)
      .maybeSingle();
    if (check.error) {
      console.error("edit-expense.update-check-error", check.error);
    }
    if (!check.data) {
      setFeedback({ type: "error", text: "Sem permissão para editar este gasto." });
      return;
    }

    setFeedback({ type: "success", text: "Gasto atualizado com sucesso." });
    router.replace(`/group/${groupId}`);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!canDelete || deleting) return;

    const confirmDelete = window.confirm("Excluir este gasto quitado? Essa ação não pode ser desfeita.");
    if (!confirmDelete) return;

    setDeleting(true);
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", expenseId)
      .eq("payer_id", currentUserId);

    if (error) {
      console.error("edit-expense.delete-error", error);
      setFeedback({ type: "error", text: "Erro ao excluir gasto." });
      setDeleting(false);
      return;
    }

    setFeedback({ type: "success", text: "Gasto excluído com sucesso." });
    router.replace(`/group/${groupId}`);
    router.refresh();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F7F7F7]">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col overflow-x-hidden">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/group/${groupId}`}>
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </Link>

          <h1 className="text-lg font-semibold text-gray-800 truncate px-2">{groupName}</h1>

          <div className="flex gap-2">
            <button onClick={() => router.back()} className="px-3 py-1 rounded-lg border" title="Cancelar" type="button">
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleUpdate}
              disabled={!canEdit}
              className="px-3 py-1 rounded-lg bg-[#5BC5A7] text-white flex items-center gap-2 disabled:opacity-60"
              type="button"
            >
              <Check className="w-4 h-4" /> {isPaid ? "Gasto pago" : canEdit ? "Atualizar" : "Somente visualização"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto px-4 py-6 pb-[calc(8rem+env(safe-area-inset-bottom))] space-y-6">
        {feedback && (
          <div className={`rounded-lg px-3 py-2 text-sm ${feedback.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {feedback.text}
          </div>
        )}
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <label className="text-gray-600 font-medium">Valor</label>
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={!canEdit}
            className="text-3xl w-full text-center border-b mt-2"
            placeholder="0,00"
          />
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm">
          <label className="block font-medium text-gray-600">Descrição</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit}
            placeholder="Ex: Churrasco, Mercado..."
            className="w-full px-4 py-2 border mt-2 rounded-lg"
          />
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm">
          <label className="font-medium text-gray-600">Quem pagou?</label>
          {participants.map((participant) => (
            <button
              key={participant.id}
              onClick={() => canEdit && setPayerId(participant.id)}
              disabled={!canEdit}
              className={`w-full text-left p-3 border rounded-lg mt-2 transition-all focus:outline-none ${payerId === participant.id ? "border-[#5BC5A7] bg-green-50 dark:bg-emerald-900/20 dark:border-emerald-400/70" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500"}`}
              type="button"
            >
              <span className="flex items-center gap-3">
                <UserAvatar name={participant.name} avatarKey={participant.avatarKey} isPremium={participant.isPremium} className="w-8 h-8" textClassName="text-xs" />
                <span>{participant.name}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm">
          <label className="font-medium text-gray-600">Quem participou?</label>
          <div className="mt-2 space-y-2">
            {participants.map((participant) => {
              const isSelected = selectedParticipants.includes(participant.id);
              const splitValue = Number(splitPreviewByParticipant[participant.id] || 0);
              return (
                <button
                  key={participant.id}
                  onClick={() => canEdit && toggleParticipant(participant.id)}
                  disabled={!canEdit}
                  className={`w-full p-3 rounded-lg border flex justify-between items-center transition-all focus:outline-none ${isSelected ? "border-[#5BC5A7] bg-green-50 dark:bg-emerald-900/20 dark:border-emerald-400/70" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500"}`}
                  type="button"
                >
                  <span className="flex items-center gap-3">
                    <UserAvatar name={participant.name} avatarKey={participant.avatarKey} isPremium={participant.isPremium} className="w-8 h-8" textClassName="text-xs" />
                    <span>{participant.name}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-semibold text-gray-800">
                      {isSelected ? `R$ ${splitValue.toFixed(2)}` : "-"}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {isSelected ? "participa" : "não"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm">
          <label className="font-medium text-gray-600">Como dividir?</label>

          <div className="flex gap-3 mt-3">
            <button
              onClick={() => canEdit && setSplitType("equal")}
              disabled={!canEdit}
              className={`flex-1 p-2 rounded-lg ${splitType === "equal" ? "bg-[#5BC5A7] text-white" : "bg-gray-200"}`}
              type="button"
            >
              Igual
            </button>
            <button
              onClick={() => canEdit && setSplitType("custom")}
              disabled={!canEdit}
              className={`flex-1 p-2 rounded-lg ${splitType === "custom" ? "bg-[#5BC5A7] text-white" : "bg-gray-200"}`}
              type="button"
            >
              Personalizada
            </button>
          </div>

          {splitType === "custom" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-gray-600">Defina o peso de cada pessoa (0 = não participa):</p>

              {participants.map((participant) => (
                <div key={participant.id} className="flex justify-between items-center border p-2 rounded-lg">
                  <span className="flex items-center gap-3">
                    <UserAvatar name={participant.name} avatarKey={participant.avatarKey} isPremium={participant.isPremium} className="w-8 h-8" textClassName="text-xs" />
                    <span>{participant.name}</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={weights[participant.id] ?? 0}
                    onChange={(e) => setWeights({ ...weights, [participant.id]: Number(e.target.value) })}
                    disabled={!canEdit}
                    className="w-20 border rounded p-1 text-center"
                  />
                </div>
              ))}

              <div className="flex gap-2 mt-2">
                <button onClick={calculateCustomSplits} disabled={!canEdit} className="bg-[#5BC5A7] text-white px-4 py-2 rounded-lg disabled:opacity-60" type="button">
                  Calcular divisão
                </button>
                <button onClick={() => setCalculatedSplits({})} disabled={!canEdit} className="px-4 py-2 rounded-lg border disabled:opacity-60" type="button">
                  Limpar
                </button>
              </div>

              {Object.keys(calculatedSplits).length > 0 && (
                <div className="mt-3 p-3 bg-gray-100 rounded-lg">
                  {Object.entries(calculatedSplits).map(([id, split]) => {
                    const participantName = participants.find((p) => p.id === id)?.name ?? id;
                    return (
                      <p key={id}>
                        <strong>{participantName}:</strong> R$ {split.toFixed(2)}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full py-3 rounded-lg bg-red-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            type="button"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? "Excluindo..." : "Excluir gasto quitado"}
          </button>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
