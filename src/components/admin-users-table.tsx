import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminUserRowActions } from "@/components/admin-user-row-actions";
import { activeLabel, type AdminUser } from "@/types/admin";
import { formatDateTime } from "@/types/card";
import { cn } from "@/lib/utils";

export function AdminUsersTable({ users }: { users: AdminUser[] }) {
  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <p className="text-sm font-medium">No users found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Users will appear here once the admin database migration has been applied.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Username</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Active</TableHead>
          <TableHead>Last Login</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.username}</TableCell>
            <TableCell className="text-muted-foreground">{user.email}</TableCell>
            <TableCell>
              <span
                className={cn(
                  "font-medium tabular-nums",
                  user.active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                )}
              >
                {activeLabel(user.active)}
              </span>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}
            </TableCell>
            <TableCell>
              <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                {user.role === "admin" ? "Admin" : "User"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <AdminUserRowActions user={user} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
