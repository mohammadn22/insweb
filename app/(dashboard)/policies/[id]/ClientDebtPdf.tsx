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

type DebtItem = {
  policyId: string;
  policyNumber: string;
  policyType: string;
  description: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  remaining: number;
  status: string;
};

type Props = {
  client: Client;
  debts: DebtItem[];
  totalDue: number;
  totalPaid: number;
  totalOutstanding: number;
  totalOverdue: number;
  totalUpcoming: number;
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

function statusLabel(status: string) {
  switch (status) {
    case "overdue":
      return "معوق";

    case "today":
      return "سررسید امروز";

    case "upcoming":
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

  policyCell: {
    width: "17%",
  },

  descriptionCell: {
    width: "20%",
  },

  dateCell: {
    width: "14%",
  },

  amountCell: {
    width: "15%",
  },

  statusCell: {
    width: "19%",
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

function ClientDebtDocument({
  client,
  debts,
  totalDue,
  totalPaid,
  totalOutstanding,
  totalOverdue,
  totalUpcoming,
}: Props) {
  return (
    <Document
      title={`صورت بدهی ${client.full_name}`}
      author="Insurance Office"
      language="fa-IR"
    >
      <Page size="A4" style={styles.page}>

        {/* HEADER */}

        <View style={styles.header}>
          <Text style={styles.title}>
            صورت وضعیت بدهی مشتری
          </Text>

          <Text style={styles.subtitle}>
            گزارش بدهی، مبالغ معوق و پرداخت‌های پیش‌رو
          </Text>
        </View>

        {/* CLIENT INFORMATION */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            اطلاعات مشتری
          </Text>

          <View style={styles.infoGrid}>

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>
                نام مشتری
              </Text>

              <Text style={styles.infoValue}>
                {client.full_name}
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>
                کد ملی
              </Text>

              <Text style={styles.infoValue}>
                {client.id_number || "-"}
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>
                شماره تماس
              </Text>

              <Text style={styles.infoValue}>
                {client.mobile || "-"}
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>
                تاریخ تهیه گزارش
              </Text>

              <Text style={styles.infoValue}>
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

          </View>
        </View>

        {/* FINANCIAL SUMMARY */}

        <View style={styles.section}>

          <Text style={styles.sectionTitle}>
            خلاصه وضعیت مالی
          </Text>

          <View style={styles.summaryGrid}>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>
                مجموع مبالغ قابل پرداخت
              </Text>

              <Text style={styles.summaryValue}>
                {formatMoney(totalDue)}
              </Text>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>
                مجموع پرداخت‌شده
              </Text>

              <Text style={styles.summaryValue}>
                {formatMoney(totalPaid)}
              </Text>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>
                بدهی باقی‌مانده
              </Text>

              <Text style={styles.summaryValue}>
                {formatMoney(totalOutstanding)}
              </Text>
            </View>

          </View>

          <View
            style={{
              ...styles.summaryGrid,
              marginTop: 8,
            }}
          >

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>
                بدهی معوق
              </Text>

              <Text style={styles.summaryValue}>
                {formatMoney(totalOverdue)}
              </Text>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>
                بدهی سررسید نشده
              </Text>

              <Text style={styles.summaryValue}>
                {formatMoney(totalUpcoming)}
              </Text>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>
                تعداد موارد بدهی
              </Text>

              <Text style={styles.summaryValue}>
                {formatMoney(debts.length)}
              </Text>
            </View>

          </View>

        </View>

        {/* DEBT BREAKDOWN */}

        <View style={styles.section}>

          <Text style={styles.sectionTitle}>
            جزئیات بدهی
          </Text>

          {debts.length === 0 ? (
            <Text>
              این مشتری در حال حاضر بدهی ثبت‌شده‌ای ندارد.
            </Text>
          ) : (
            <View style={styles.table}>

              <View style={styles.tableHeader}>

                <Text
                  style={[
                    styles.headerCell,
                    styles.policyCell,
                  ]}
                >
                  بیمه‌نامه
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
                  پرداخت
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

              {debts.map((debt) => (
                <View
                  key={`${debt.policyId}-${debt.description}-${debt.dueDate}`}
                  style={styles.tableRow}
                >

                  <Text
                    style={[
                      styles.cell,
                      styles.policyCell,
                    ]}
                  >
                    {debt.policyNumber}
                    {"\n"}
                    {debt.policyType}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.descriptionCell,
                    ]}
                  >
                    {debt.description}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.dateCell,
                    ]}
                  >
                    {formatDate(debt.dueDate)}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.amountCell,
                    ]}
                  >
                    {formatMoney(debt.amountDue)}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.amountCell,
                    ]}
                  >
                    {formatMoney(debt.amountPaid)}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.amountCell,
                    ]}
                  >
                    {formatMoney(debt.remaining)}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.statusCell,
                    ]}
                  >
                    {statusLabel(debt.status)}
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
            این گزارش وضعیت بدهی مشتری را بر اساس
            برنامه‌های پرداخت ثبت‌شده نشان می‌دهد.
          </Text>

        </View>

      </Page>
    </Document>
  );
}

export default function ClientDebtPdf({
  client,
  debts,
  totalDue,
  totalPaid,
  totalOutstanding,
  totalOverdue,
  totalUpcoming,
}: Props) {
  const fileName =
    `صورت-بدهی-${client.full_name}.pdf`;

  return (
    <PDFDownloadLink
      document={
        <ClientDebtDocument
          client={client}
          debts={debts}
          totalDue={totalDue}
          totalPaid={totalPaid}
          totalOutstanding={totalOutstanding}
          totalOverdue={totalOverdue}
          totalUpcoming={totalUpcoming}
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
            : "دانلود صورت بدهی PDF"}
        </button>
      )}
    </PDFDownloadLink>
  );
}