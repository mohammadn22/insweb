"use client";

import { useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type Client = {
  id: string;
  full_name: string;
  id_number: string;
};

type RenewalData = {
  previousPolicyId: string;
  clientId: string;
  policyType: string;
};

const POLICY_TYPES = [
  "Third Party Car",
  "Third Party Motorcycle",
  "Third Party Other",
  "Fire",
  "Responsibilities",
  "Car Body",
  "Cargo Transportation",
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);

  return date.toISOString().split("T")[0];
}

export default function AddPolicyForm({
  clients: initialClients,
  renewalData,
}: {
  clients: Client[];
  renewalData?: RenewalData;
}) {
  const supabase = createClient();

  const [clientSearch, setClientSearch] = useState("");

  const [clients, setClients] =
    useState<Client[]>(initialClients);

  const [selectedClient, setSelectedClient] =
    useState<Client | null>(
      renewalData
        ? initialClients.find(
            (client) => client.id === renewalData.clientId
          ) || null
        : null
    );

  const [policyNumber, setPolicyNumber] = useState("");

  const [policyType, setPolicyType] = useState(
    renewalData?.policyType &&
      POLICY_TYPES.includes(renewalData.policyType)
      ? renewalData.policyType
      : POLICY_TYPES[0]
  );

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [totalPrice, setTotalPrice] = useState("");
  const [initialPaymentRequired, setInitialPaymentRequired] =
    useState("");
  const [actualPaidToday, setActualPaidToday] =
    useState("");

  const [installmentCount, setInstallmentCount] =
    useState("0");

  const [firstInstallmentOffset, setFirstInstallmentOffset] =
    useState("40");

  const [installmentInterval, setInstallmentInterval] =
    useState("30");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const total = Number(totalPrice) || 0;
  const initialRequired =
    Number(initialPaymentRequired) || 0;
  const paidToday = Number(actualPaidToday) || 0;
  const numberOfInstallments =
    Number(installmentCount) || 0;

  const remainingAmount = Math.max(
    total - initialRequired,
    0
  );

  const installmentAmount =
    numberOfInstallments > 0
      ? remainingAmount / numberOfInstallments
      : 0;

  const upfrontDebt = Math.max(
    initialRequired - paidToday,
    0
  );

  const filteredClients = clients
    .filter(
      (client) =>
        client.full_name
          .toLowerCase()
          .includes(clientSearch.toLowerCase()) ||
        client.id_number.includes(clientSearch)
    )
    .slice(0, 10);

  const schedule = useMemo(() => {
    if (
      !startDate ||
      numberOfInstallments <= 0 ||
      installmentAmount <= 0
    ) {
      return [];
    }

    return Array.from(
      { length: numberOfInstallments },
      (_, index) => {
        const sequence = index + 1;

        const days =
          Number(firstInstallmentOffset) +
          index * Number(installmentInterval);

        return {
          sequence,
          amount: installmentAmount,
          dueDate: addDays(startDate, days),
        };
      }
    );
  }, [
    startDate,
    numberOfInstallments,
    installmentAmount,
    firstInstallmentOffset,
    installmentInterval,
  ]);

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setMessage("");

    if (!selectedClient) {
      setMessage("Please select a client.");
      return;
    }

    if (!policyNumber.trim()) {
      setMessage("Please enter a policy number.");
      return;
    }

    if (!startDate || !endDate) {
      setMessage("Please enter the policy dates.");
      return;
    }

    if (endDate <= startDate) {
      setMessage(
        "End date must be after start date."
      );
      return;
    }

    if (total <= 0) {
      setMessage(
        "Total price must be greater than zero."
      );
      return;
    }

    if (initialRequired > total) {
      setMessage(
        "Initial payment cannot exceed the total price."
      );
      return;
    }

    if (
      paidToday < 0 ||
      paidToday > initialRequired
    ) {
      setMessage(
        "Amount paid today cannot be greater than the required initial payment."
      );
      return;
    }

    if (numberOfInstallments > 0) {
      if (Number(firstInstallmentOffset) < 0) {
        setMessage(
          "First installment offset cannot be negative."
        );
        return;
      }

      if (Number(installmentInterval) <= 0) {
        setMessage(
          "Installment interval must be greater than zero."
        );
        return;
      }
    }

    setSaving(true);

    try {
      const { data: policy, error: policyError } =
        await supabase
          .from("policies")
          .insert({
            client_id: selectedClient.id,

            previous_policy_id:
              renewalData?.previousPolicyId || null,

            policy_number:
              policyNumber.trim(),

            policy_type: policyType,

            start_date: startDate,

            end_date: endDate,

            total_price: total,

            initial_payment_required:
              initialRequired,

            installment_count:
              numberOfInstallments,

            first_installment_offset_days:
              numberOfInstallments > 0
                ? Number(firstInstallmentOffset)
                : null,

            installment_interval_days:
              numberOfInstallments > 0
                ? Number(installmentInterval)
                : null,
          })
          .select()
          .single();

      if (policyError || !policy) {
        throw new Error(
          policyError?.message ||
            "Could not create policy."
        );
      }

      const scheduleRows = [
        {
          policy_id: policy.id,
          sequence_number: 0,
          description: "Upfront payment",
          amount_due: initialRequired,
          due_date: startDate,
        },

        ...schedule.map((item) => ({
          policy_id: policy.id,
          sequence_number: item.sequence,
          description:
            `Installment ${item.sequence}`,
          amount_due: item.amount,
          due_date: item.dueDate,
        })),
      ].filter(
        (item) => item.amount_due > 0
      );

      if (scheduleRows.length > 0) {
        const { error: scheduleError } =
          await supabase
            .from("payment_schedule")
            .insert(scheduleRows);

        if (scheduleError) {
          throw new Error(
            scheduleError.message
          );
        }
      }

      if (paidToday > 0) {
        const {
          data: transaction,
          error: transactionError,
        } = await supabase
          .from("transactions")
          .insert({
            client_id: selectedClient.id,
            policy_id: policy.id,
            amount: paidToday,
            payment_date: new Date()
              .toISOString()
              .split("T")[0],
            payment_method: "cash",
            description:
              "Initial payment",
          })
          .select()
          .single();

        if (
          transactionError ||
          !transaction
        ) {
          throw new Error(
            transactionError?.message ||
              "Could not record initial payment."
          );
        }

        if (initialRequired > 0) {
          const {
            data: upfrontSchedule,
          } = await supabase
            .from("payment_schedule")
            .select("id")
            .eq(
              "policy_id",
              policy.id
            )
            .eq(
              "sequence_number",
              0
            )
            .single();

          if (upfrontSchedule) {
            const {
              error: allocationError,
            } = await supabase
              .from(
                "transaction_allocations"
              )
              .insert({
                transaction_id:
                  transaction.id,

                payment_schedule_id:
                  upfrontSchedule.id,

                amount: paidToday,
              });

            if (allocationError) {
              throw new Error(
                allocationError.message
              );
            }
          }
        }
      }

      setMessage(
        "Policy created successfully."
      );

      setClientSearch("");
      setSelectedClient(null);
      setPolicyNumber("");
      setStartDate("");
      setEndDate("");
      setTotalPrice("");
      setInitialPaymentRequired("");
      setActualPaidToday("");
      setInstallmentCount("0");

    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ maxWidth: "700px" }}
    >
      <section>
        <h2>Client</h2>

        {renewalData ? (
          <div>
            <strong>
              {selectedClient?.full_name ||
                "Client not found"}
            </strong>

            <div>
              {selectedClient?.id_number || "-"}
            </div>

            <p>
              This policy is being renewed
              for the existing client.
            </p>
          </div>
        ) : selectedClient ? (
          <div>
            <strong>
              {selectedClient.full_name}
            </strong>

            <div>
              {selectedClient.id_number}
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedClient(null);
                setClientSearch("");
                setClients(initialClients);
              }}
            >
              Change client
            </button>
          </div>
        ) : (
          <>
            <input
              value={clientSearch}
              onChange={(e) =>
                setClientSearch(
                  e.target.value
                )
              }
              placeholder="Search client by name or ID number"
            />

            {clientSearch.trim() &&
              filteredClients.length > 0 && (
                <div>
                  {filteredClients.map(
                    (client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setSelectedClient(
                            client
                          );

                          setClientSearch(
                            client.full_name
                          );

                          setClients([]);
                        }}
                      >
                        {client.full_name} —{" "}
                        {client.id_number}
                      </button>
                    )
                  )}
                </div>
              )}
          </>
        )}
      </section>

      <section>
        <h2>Policy information</h2>

        <label>
          Policy number

          <input
            value={policyNumber}
            onChange={(e) =>
              setPolicyNumber(
                e.target.value
              )
            }
          />
        </label>

        <label>
          Policy type

          <select
            value={policyType}
            onChange={(e) =>
              setPolicyType(
                e.target.value
              )
            }
          >
            {POLICY_TYPES.map(
              (type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              )
            )}
          </select>
        </label>

        <label>
          Start date

          <input
            type="date"
            value={startDate}
            onChange={(e) =>
              setStartDate(
                e.target.value
              )
            }
          />
        </label>

        <label>
          End date

          <input
            type="date"
            value={endDate}
            onChange={(e) =>
              setEndDate(
                e.target.value
              )
            }
          />
        </label>
      </section>

      <section>
        <h2>Payment plan</h2>

        <label>
          Total price

          <input
            type="number"
            min="0"
            value={totalPrice}
            onChange={(e) =>
              setTotalPrice(
                e.target.value
              )
            }
          />
        </label>

        <label>
          Initial payment required

          <input
            type="number"
            min="0"
            value={
              initialPaymentRequired
            }
            onChange={(e) =>
              setInitialPaymentRequired(
                e.target.value
              )
            }
          />
        </label>

        <label>
          Amount actually paid today

          <input
            type="number"
            min="0"
            value={actualPaidToday}
            onChange={(e) =>
              setActualPaidToday(
                e.target.value
              )
            }
          />
        </label>

        <label>
          Number of installments

          <select
            value={installmentCount}
            onChange={(e) =>
              setInstallmentCount(
                e.target.value
              )
            }
          >
            {Array.from(
              { length: 11 },
              (_, i) => (
                <option
                  key={i}
                  value={i}
                >
                  {i}
                </option>
              )
            )}
          </select>
        </label>

        {numberOfInstallments > 0 && (
          <>
            <label>
              First installment offset
              (days)

              <input
                type="number"
                min="0"
                value={
                  firstInstallmentOffset
                }
                onChange={(e) =>
                  setFirstInstallmentOffset(
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Installment interval
              (days)

              <input
                type="number"
                min="1"
                value={
                  installmentInterval
                }
                onChange={(e) =>
                  setInstallmentInterval(
                    e.target.value
                  )
                }
              />
            </label>
          </>
        )}
      </section>

      <section>
        <h2>
          Calculated payment plan
        </h2>

        <p>
          Remaining after initial
          payment:{" "}
          <strong>
            {formatMoney(
              remainingAmount
            )}
          </strong>
        </p>

        {numberOfInstallments > 0 && (
          <p>
            Each installment:{" "}
            <strong>
              {formatMoney(
                installmentAmount
              )}
            </strong>
          </p>
        )}

        <p>
          Initial outstanding debt:{" "}
          <strong>
            {formatMoney(
              upfrontDebt
            )}
          </strong>
        </p>

        {schedule.length > 0 && (
          <div>
            {schedule.map(
              (item) => (
                <div
                  key={
                    item.sequence
                  }
                >
                  Installment{" "}
                  {item.sequence}:{" "}
                  {formatMoney(
                    item.amount
                  )}{" "}
                  — {item.dueDate}
                </div>
              )
            )}
          </div>
        )}
      </section>

      {message && (
        <p
          className={
            message.includes(
              "successfully"
            )
              ? "text-green-600"
              : "text-red-600"
          }
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
      >
        {saving
          ? "Saving..."
          : "Create Policy"}
      </button>
    </form>
  );
}