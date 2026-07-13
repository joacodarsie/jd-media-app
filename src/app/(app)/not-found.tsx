import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-10">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Compass className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-semibold">No encontramos esta página</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                El link puede estar viejo o la sección se movió. Volvé al inicio y
                seguí desde ahí.
              </p>
            </div>
          </div>
          <Button asChild variant="default" className="gap-1.5">
            <Link href="/dashboard">
              <Home className="h-3.5 w-3.5" />
              Volver al inicio
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
