import SwiftUI

struct PermissionRulesView: View {
    @Bindable var viewModel: PermissionRulesViewModel
    @Environment(\.appTheme) private var theme

    var body: some View {
        SettingsPage {
            if viewModel.rules.isEmpty {
                emptyState
            } else {
                SettingsListSection(items: viewModel.rules) { rule in
                    ruleRow(rule)
                }
            }
            Spacer(minLength: 0)
        }
        .overlayScrollbar()
    }

    private var emptyState: some View {
        SettingsEmptyState(title: "暂无永久权限规则", systemImage: "lock.slash", reload: viewModel.reload)
    }

    private func ruleRow(_ rule: PermissionRuleEntry) -> some View {
        SettingsRow(rule.toolName) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Text(rule.decision == "allow" ? "允许" : "拒绝")
                        .font(theme.typography.captionFont)
                        .foregroundStyle(rule.decision == "allow" ? theme.colors.accent : theme.colors.error)
                    Text(rule.createdAtText)
                        .font(theme.typography.captionFont)
                        .foregroundStyle(theme.colors.textSecondary)
                    Spacer()
                    SettingsActionButton(title: "撤销", role: .destructive) {
                        viewModel.revoke(ruleId: rule.id)
                    }
                }
                Text("永久生效 · 所有参数 · 所有桌宠与 Thread")
                    .font(theme.typography.captionFont.monospaced())
                    .foregroundStyle(theme.colors.textSecondary)
                    .textSelection(.enabled)
                    .lineLimit(4)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}
