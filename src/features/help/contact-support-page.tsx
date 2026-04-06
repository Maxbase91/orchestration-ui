import { useState } from 'react';
import { Mail, Clock, Phone, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';

const faqLinks = [
  { question: 'How do I submit a procurement request?', articleId: 'gs-1' },
  { question: 'How do approvals work?', articleId: 'ra-2' },
  { question: 'How do I onboard a new supplier?', articleId: 'sup-1' },
  { question: 'What are the buying channels?', articleId: 'gs-2' },
];

export function ContactSupportPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('Anna Mueller');
  const [email, setEmail] = useState('anna.mueller@company.com');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !priority || !subject || !description) {
      toast.error('Please fill in all required fields');
      return;
    }
    toast.success(
      'Support ticket submitted successfully. You will receive a confirmation email shortly.'
    );
    setCategory('');
    setPriority('');
    setSubject('');
    setDescription('');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contact Support"
        subtitle="Get help from our support team"
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Contact form */}
        <div className="lg:col-span-3">
          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="feature-request">
                        Feature Request
                      </SelectItem>
                      <SelectItem value="bug-report">Bug Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please provide as much detail as possible..."
                  rows={5}
                />
              </div>
              <Button type="submit" className="w-full">
                Submit Support Ticket
              </Button>
            </form>
          </Card>
        </div>

        {/* Right: Support info + FAQ */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-6 space-y-4">
            <h3 className="font-medium">Support Information</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Mail className="size-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">
                    support@gp-procurement.com
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="size-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Business Hours</p>
                  <p className="text-sm text-muted-foreground">
                    Mon-Fri, 8:00 AM - 6:00 PM CET
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="size-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Response Time</p>
                  <p className="text-sm text-muted-foreground">
                    Less than 4 hours during business hours
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="size-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Emergency Hotline</p>
                  <p className="text-sm text-muted-foreground">
                    +49 69 123 456 789
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-3">
            <h3 className="font-medium">Frequently Asked Questions</h3>
            <div className="space-y-2">
              {faqLinks.map((faq) => (
                <button
                  key={faq.articleId}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50"
                  onClick={() => navigate('/help/kb')}
                >
                  <ExternalLink className="size-3.5 shrink-0" />
                  {faq.question}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
