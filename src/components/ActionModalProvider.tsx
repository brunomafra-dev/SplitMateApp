"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { PlusCircle, Users, Receipt } from "lucide-react";

const ModalContext = createContext<() => void>(() => {});

export default function ActionModalProvider({ children }: any) {
  const [open, setOpen] = useState(false);

  function toggle() {
    setOpen(prev => !prev);
  }

  return (
    <ModalContext.Provider value={toggle}>
      {children}

      {open && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
          onClick={toggle}
        >
          <div
            className="bg-white w-full max-w-2xl p-6 rounded-t-2xl shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              O que deseja fazer?
            </h2>

            <div className="space-y-3">

              <Link
                href="/create-group"
                onClick={toggle}
                className="flex items-center gap-3 p-4 border rounded-xl hover:bg-gray-50"
              >
                <Users className="w-6 h-6 text-[#5BC5A7]" />
                <span className="text-gray-800 font-medium">Criar novo grupo</span>
              </Link>

              <Link
                href="/group/select/add-expense"
                onClick={toggle}
                className="flex items-center gap-3 p-4 border rounded-xl hover:bg-gray-50"
              >
                <Receipt className="w-6 h-6 text-[#5BC5A7]" />
                <span className="text-gray-800 font-medium">Adicionar gasto</span>
              </Link>

              <Link
                href="/payments"
                onClick={toggle}
                className="flex items-center gap-3 p-4 border rounded-xl hover:bg-gray-50"
              >
                <PlusCircle className="w-6 h-6 text-[#5BC5A7]" />
                <span className="text-gray-800 font-medium">Registrar pagamento</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useActionModal() {
  return useContext(ModalContext);
}
