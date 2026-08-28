"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  PDFDownloadLink,
} from "@react-pdf/renderer";

Font.register({
  family: "Vazirmatn",
  fonts: [
    {
      src: "/fonts/Vazirmatn-Regular.ttf",
      fontWeight: 400,
    },
    {
      src: "/fonts/Vazirmatn-Bold.ttf",
      fontWeight: 700,
    },
  ],
});

type Client = {
  full_name: string;
  id_number: string;
  mobile: string | null;
};

type Policy = {
  policy_number: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  total_price: number;
};

type ScheduleItem = {
  id: string;
  sequence_number: number;
  description: string;
  amount_due: number;
  due_date: string;
  amount_paid: number;
  remaining: number;
  status: string;
};

type Transaction = {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  description: string | null;
};

type Props = {
  policy: Policy;
  client: Client | null;
  schedule: ScheduleItem[];
  transactions: Transaction[];
  totalPaid: number;
  totalOutstanding: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("fa-IR").format(
    Math.round(value)
  );
}

function formatDate(date: string) {
  if (!date) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat(
      "fa-IR-u-ca-persian",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).format(new Date(`${date}T00:00:00`));
  } catch {
    return date;
  }
}

function paymentMethodLabel(method: string) {
  switch (method) {
    case "cash":
      return "نقدی";

    case "card":
      return "کارت بانکی";

    case "bank_transfer":
      return "انتقال بانکی";

    case "other":
      return "سایر";

    default:
      return method;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "Paid":
      return "پرداخت شده";

    case "Partially Paid":
      return "پرداخت ناقص";

    case "Partially Overdue":
      return "بخشی معوق";

    case "Overdue":
      return "معوق";

    case "Due":
      return "سررسید نشده";

    default:
      return status;
  }
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 45,
    fontFamily: "Vazirmatn",
    direction: "rtl",
    fontSize: 10,
  },

  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#222222",
    paddingBottom: 12,
    marginBottom: 20,
  },

  title: {
    fontSize: 20,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 10,
    textAlign: "center",
  },

  section: {
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 8,
    textAlign: "right",
  },

  infoGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
  },

  infoBox: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#dddddd",
    padding: 8,
  },

  infoLabel: {
    fontSize: 8,
    color: "#666666",
    marginBottom: 3,
  },

  infoValue: {
    fontSize: 10,
    fontWeight: 700,
  },

  summaryGrid: {
    flexDirection: "row-reverse",
    gap: 8,
  },

  summaryBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#dddddd",
    padding: 10,
    textAlign: "center",
  },

  summaryLabel: {
    fontSize: 8,
    color: "#666666",
    marginBottom: 5,
  },

  summaryValue: {
    fontSize: 13,
    fontWeight: 700,
  },

  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#cccccc",
  },

  tableHeader: {
    flexDirection: "row-reverse",
    backgroundColor: "#eeeeee",
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
  },

  tableRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },

  cell: {
    padding: 6,
    borderLeftWidth: 1,
    borderLeftColor: "#eeeeee",
    textAlign: "right",
  },

  headerCell: {
    padding: 6,
    fontWeight: 700,
    textAlign: "right",
  },

  numberCell: {
    width: "8%",
  },

  descriptionCell: {
    width: "22%",
  },

  dateCell: {
    width: "16%",
  },

  amountCell: {
    width: "18%",
  },

  statusCell: {
    width: "20%",
  },

  methodCell: {
    width: "18%",
  },

  footer: {
    marginTop: 25,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#cccccc",
    textAlign: "center",
    fontSize: 8,
    color: "#666666",
  },
});

function PolicyTransactionDocument({
  policy,
  client,
  schedule,
  transactions,
  totalPaid,
  totalOutstanding,
}: Props) {
  return (
    <Document
      title={`صورت وضعیت مالی بیمه‌نامه ${policy.policy_number}`}
      author="Insurance Office"
      language="fa-IR"
    >
      <Page size="A4" style={styles.page}>

        {/* HEADER */}

        <View style={styles.header}>
          <Text style={styles.title}>
            صورت وضعیت مالی بیمه‌نامه
          </Text>

          <Text style={styles.subtitle}>
            گزارش تراکنش‌ها، برنامه پرداخت و مانده حساب
          </Text>
        </View>

        {/* POLICY INFORMATION */}

        <View style={styles.section}>

          <Text style={styles.sectionTitle}>
            اطلاعات بیمه‌نامه
          </Text>

          <View style={styles.infoGrid}>

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>
                شماره بیمه‌نامه
              </Text>

              <Text style={styles.infoValue}>
                {policy.policy_number}
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>
                نوع بیمه
              </Text>

              <Text style={styles.infoValue}>
                {policy.policy_type}
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>
                نام بیمه‌گذار
              </Text>

              <Text style={styles.infoValue}>
                {client?.full_name || "-"}
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>
                کد ملی
              </Text>

              <Text style={styles.infoValue}>
                {client?.id_number || "-"}
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>
                تاریخ شروع
              </Text>

              <Text style={styles.infoValue}>
                {formatDate(policy.start_date)}
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>
                تاریخ پایان
              </Text>

              <Text style={styles.infoValue}>
                {formatDate(policy.end_date)}
              </Text>
            </View>

          </View>

        </View>

        {/* SUMMARY */}

        <View style={styles.section}>

          <Text style={styles.sectionTitle}>
            خلاصه مالی
          </Text>

          <View style={styles.summaryGrid}>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>
                مبلغ کل بیمه‌نامه
              </Text>

              <Text style={styles.summaryValue}>
                {formatMoney(policy.total_price)}
              </Text>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>
                مبلغ پرداخت‌شده
              </Text>

              <Text style={styles.summaryValue}>
                {formatMoney(totalPaid)}
              </Text>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>
                مانده حساب
              </Text>

              <Text style={styles.summaryValue}>
                {formatMoney(totalOutstanding)}
              </Text>
            </View>

          </View>

        </View>

        {/* PAYMENT SCHEDULE */}

        <View style={styles.section}>

          <Text style={styles.sectionTitle}>
            برنامه پرداخت
          </Text>

          {schedule.length === 0 ? (
            <Text>
              برنامه پرداختی ثبت نشده است.
            </Text>
          ) : (
            <View style={styles.table}>

              <View style={styles.tableHeader}>

                <Text
                  style={[
                    styles.headerCell,
                    styles.numberCell,
                  ]}
                >
                  ردیف
                </Text>

                <Text
                  style={[
                    styles.headerCell,
                    styles.descriptionCell,
                  ]}
                >
                  شرح
                </Text>

                <Text
                  style={[
                    styles.headerCell,
                    styles.dateCell,
                  ]}
                >
                  سررسید
                </Text>

                <Text
                  style={[
                    styles.headerCell,
                    styles.amountCell,
                  ]}
                >
                  مبلغ
                </Text>

                <Text
                  style={[
                    styles.headerCell,
                    styles.amountCell,
                  ]}
                >
                  پرداخت‌شده
                </Text>

                <Text
                  style={[
                    styles.headerCell,
                    styles.amountCell,
                  ]}
                >
                  مانده
                </Text>

                <Text
                  style={[
                    styles.headerCell,
                    styles.statusCell,
                  ]}
                >
                  وضعیت
                </Text>

              </View>

              {schedule.map((item) => (
                <View
                  key={item.id}
                  style={styles.tableRow}
                >

                  <Text
                    style={[
                      styles.cell,
                      styles.numberCell,
                    ]}
                  >
                    {item.sequence_number === 0
                      ? "-"
                      : item.sequence_number}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.descriptionCell,
                    ]}
                  >
                    {item.description}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.dateCell,
                    ]}
                  >
                    {formatDate(item.due_date)}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.amountCell,
                    ]}
                  >
                    {formatMoney(item.amount_due)}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.amountCell,
                    ]}
                  >
                    {formatMoney(item.amount_paid)}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.amountCell,
                    ]}
                  >
                    {formatMoney(item.remaining)}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.statusCell,
                    ]}
                  >
                    {statusLabel(item.status)}
                  </Text>

                </View>
              ))}

            </View>
          )}

        </View>

        {/* TRANSACTIONS */}

        <View style={styles.section}>

          <Text style={styles.sectionTitle}>
            تراکنش‌های مالی
          </Text>

          {transactions.length === 0 ? (
            <Text>
              تاکنون پرداختی ثبت نشده است.
            </Text>
          ) : (
            <View style={styles.table}>

              <View style={styles.tableHeader}>

                <Text
                  style={[
                    styles.headerCell,
                    styles.dateCell,
                  ]}
                >
                  تاریخ
                </Text>

                <Text
                  style={[
                    styles.headerCell,
                    styles.amountCell,
                  ]}
                >
                  مبلغ
                </Text>

                <Text
                  style={[
                    styles.headerCell,
                    styles.methodCell,
                  ]}
                >
                  روش پرداخت
                </Text>

                <Text
                  style={[
                    styles.headerCell,
                    styles.descriptionCell,
                  ]}
                >
                  شرح
                </Text>

              </View>

              {transactions.map((transaction) => (
                <View
                  key={transaction.id}
                  style={styles.tableRow}
                >

                  <Text
                    style={[
                      styles.cell,
                      styles.dateCell,
                    ]}
                  >
                    {formatDate(
                      transaction.payment_date
                    )}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.amountCell,
                    ]}
                  >
                    {formatMoney(transaction.amount)}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.methodCell,
                    ]}
                  >
                    {paymentMethodLabel(
                      transaction.payment_method
                    )}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.descriptionCell,
                    ]}
                  >
                    {transaction.description || "-"}
                  </Text>

                </View>
              ))}

            </View>
          )}

        </View>

        {/* FOOTER */}

        <View style={styles.footer}>
          <Text>
            این سند توسط سامانه مدیریت بیمه صادر شده است.
          </Text>

          <Text>
            تاریخ تهیه گزارش:{" "}
            {new Intl.DateTimeFormat(
              "fa-IR-u-ca-persian",
              {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }
            ).format(new Date())}
          </Text>
        </View>

      </Page>
    </Document>
  );
}

export default function PolicyTransactionPdf({
  policy,
  client,
  schedule,
  transactions,
  totalPaid,
  totalOutstanding,
}: Props) {
  const fileName =
    `صورت-وضعیت-${policy.policy_number}.pdf`;

  return (
    <PDFDownloadLink
      document={
        <PolicyTransactionDocument
          policy={policy}
          client={client}
          schedule={schedule}
          transactions={transactions}
          totalPaid={totalPaid}
          totalOutstanding={totalOutstanding}
        />
      }
      fileName={fileName}
    >
      {({ loading }) => (
        <button
          type="button"
          disabled={loading}
          className="rounded-md bg-black px-5 py-2 text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "در حال آماده‌سازی PDF..."
            : "دانلود صورت وضعیت PDF"}
        </button>
      )}
    </PDFDownloadLink>
  );
}